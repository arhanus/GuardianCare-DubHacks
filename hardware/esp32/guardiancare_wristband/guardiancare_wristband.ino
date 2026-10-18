/*
  GuardianCare - Hand-back PPG integrated firmware V3
  ESP32-S3-N16R8 | Arduino board: ESP32S3 Dev Module
  Physical COM/UART connector | USB CDC On Boot: Disabled
  Serial Monitor baud: 115200 (Serial0)

  Existing wiring (unchanged):
    MAX30102 and MPU6500/MPU6050: SDA GPIO8, SCL GPIO9
    DS18B20: GPIO4
    Vibration motor DRIVER input: GPIO5

  Required Arduino libraries:
    SparkFun MAX3010x Sensor Library (MAX30105.h)
    OneWire
    DallasTemperature
    (WiFi / HTTPClient come with the ESP32 core)

  Backend: copy secrets.example.h to secrets.h and fill in WiFi, SERVER_URL, API_KEY.

  Commands in Serial Monitor:
    1 = start real RED/IR CSV recording
    q = stop recording; live monitoring continues
    v = vibrate for 2 seconds
    s = stop vibration

  V3 fixes:
    - Proven 6-byte RED+IR FIFO reads; no experimental 48-byte batches.
    - Do NOT clear FIFO merely because overflow counter is nonzero:
      read queued samples first; a successful pop resets that counter.
    - Count overflow incidents (not the number of poll-loop iterations).
    - Downsampled autocorrelation; nonblocking temperature acquisition.
    - Preserve real IMU, DS18B20, vibration and 1/q CSV workflow.
    - No simulated BPM or medical-grade accuracy claim.

  Experimental prototype ONLY. Not for clinical use.
*/

#include <Arduino.h>
#include <Wire.h>
#include <MAX30105.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <math.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "secrets.h"  // WIFI_SSID, WIFI_PASSWORD, SERVER_URL, API_KEY (untracked)

// -------------------- Hardware --------------------
constexpr int SDA_PIN = 8;
constexpr int SCL_PIN = 9;
constexpr int TEMP_PIN = 4;
constexpr int MOTOR_PIN = 5;
constexpr uint8_t PPG_ADDR = 0x57;
constexpr uint8_t IMU_ADDR = 0x68;
constexpr uint32_t BAUD = 115200;

MAX30105 optical;
OneWire oneWire(TEMP_PIN);
DallasTemperature thermometer(&oneWire);
DeviceAddress temperatureAddress;

bool opticalReady = false;
bool imuReady = false;
bool imuValid = false;
bool temperatureReady = false;
bool temperatureValid = false;

float ax = 0, ay = 0, az = 0;
float gx = 0, gy = 0, gz = 0;
float temperatureC = 0;

bool motorOn = false;
uint32_t motorStartedMs = 0;
// Set by the sender task from the server's answer: the wristband has an unanswered red alarm.
volatile bool serverVibrate = false;
volatile uint32_t serverVibrateAtMs = 0;  // when the server last answered
bool alarmDriving = false;                // the motor is currently driven by the alarm, not the serial command
constexpr uint32_t ALARM_PULSE_MS = 500;
constexpr uint32_t ALARM_STALE_MS = 10000;  // no answer for this long: stop buzzing rather than buzz forever
uint32_t lastIMUMs = 0;
uint32_t motionBlockUntilMs = 0;

bool temperaturePending = false;
uint32_t temperatureStartedMs = 0;

// -------------------- PPG --------------------
// Hardware setup is identical to the previously successful wrist CSV test:
// LED 0x40, average 2, RED + IR, 200 Hz, 411 us, ADC range 8192.
constexpr uint8_t LED_CURRENT = 0x40;
constexpr uint8_t LED_AVERAGE = 2;
constexpr uint8_t LED_MODE = 2;
constexpr int PPG_RATE_SETTING = 200;
constexpr int PPG_PULSE_WIDTH = 411;
constexpr int PPG_ADC_RANGE = 8192;

// Each 4th filtered optical sample is retained for autocorrelation.
// The 100-106 Hz output rate becomes ~25-26.5 Hz analysis rate.
constexpr uint8_t DOWNSAMPLE = 4;
constexpr uint16_t HISTORY_CAPACITY = 384;  // ~14 s of filtered samples
constexpr uint16_t ANALYSIS_CAPACITY = 300; // ~10 s of filtered samples
float irHistory[HISTORY_CAPACITY];
float redHistory[HISTORY_CAPACITY];
float analysisIR[ANALYSIS_CAPACITY];
uint16_t historyHead = 0;
uint16_t historyCount = 0;
uint8_t downsamplePhase = 0;

bool filterReady = false;
float baselineIR = 0, baselineRED = 0;
float filteredIR = 0, filteredRED = 0;
uint32_t rawIR = 0, rawRED = 0;
uint32_t lastOpticalMs = 0;
uint32_t totalSamples = 0;
uint32_t i2cErrors = 0;
uint32_t fifoOverflows = 0;
uint32_t lastOverflowNoticeMs = 0;
uint32_t lastPPGPollUs = 0;
bool fifoOverflowLatched = false;
uint8_t lastFIFOWritePtr = 0;
uint8_t lastFIFOReadPtr = 0;
uint8_t lastFIFOOverflowRegister = 0;
uint32_t fifoReadSamples = 0;
uint32_t fifoClearCount = 0;

float opticalSampleRate = 100.0f;
uint32_t rateCountStart = 0;
uint32_t rateTimeStartUs = 0;
uint32_t lastRateUpdateMs = 0;
uint32_t lastHeartUpdateMs = 0;
uint32_t lastPrintMs = 0;

bool heartValid = false;
float heartBPM = 0.0f;
float heartRMS = 0.0f;
float heartPeriodicity = 0.0f;
float heartChannelCorrelation = 0.0f;
const char *heartStatus = "WARMUP";

bool csvRecording = false;
uint32_t recordingSamples = 0;
uint32_t recordingErrorsStart = 0;
uint32_t recordingOverflowStart = 0;

// -------------------- Generic I2C --------------------
bool readRegisterBlock(uint8_t addr, uint8_t reg,
                       uint8_t *dest, uint8_t count) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  const size_t got = Wire.requestFrom(addr, count);
  if (got != count) {
    while (Wire.available() > 0) Wire.read();
    return false;
  }
  for (uint8_t i = 0; i < count; i++) dest[i] = Wire.read();
  return true;
}

bool writeIMU(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(IMU_ADDR);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

bool writeIMUChecked(uint8_t reg, uint8_t value) {
  for (int n = 0; n < 3; n++) {
    if (writeIMU(reg, value)) { delay(10); return true; }
    delay(30);
  }
  Serial0.print("# IMU register write failed 0x");
  Serial0.println(reg, HEX);
  return false;
}

int16_t signedWord(uint8_t hi, uint8_t lo) {
  return (int16_t)(((uint16_t)hi << 8) | lo);
}

// -------------------- MPU6500 / MPU6050 --------------------
bool initializeIMU() {
  uint8_t id = 0;
  if (!readRegisterBlock(IMU_ADDR, 0x75, &id, 1)) return false;
  Serial0.print("# IMU WHO_AM_I: 0x");
  Serial0.println(id, HEX);
  if (id != 0x70 && id != 0x68) return false;

  writeIMU(0x6B, 0x80);                 // Soft reset
  delay(300);
  if (!writeIMUChecked(0x6B, 0x01)) return false;
  delay(100);
  uint8_t checkedID = 0;
  if (!readRegisterBlock(IMU_ADDR, 0x75, &checkedID, 1)
      || checkedID != id) return false;

  if (!writeIMUChecked(0x6C, 0x00)) return false;
  if (!writeIMUChecked(0x1A, 0x03)) return false;
  if (!writeIMUChecked(0x19, 0x09)) return false;
  if (!writeIMUChecked(0x1B, 0x00)) return false;
  if (!writeIMUChecked(0x1C, 0x00)) return false;
  if (id == 0x70 && !writeIMUChecked(0x1D, 0x03)) return false;
  uint8_t power = 0;
  return readRegisterBlock(IMU_ADDR, 0x6B, &power, 1)
      && !(power & 0x40);
}

void updateIMU() {
  if (!imuReady) return;
  const uint32_t now = millis();
  if ((uint32_t)(now - lastIMUMs) < 20) return;
  lastIMUMs = now;
  uint8_t bytes[14];
  imuValid = readRegisterBlock(IMU_ADDR, 0x3B, bytes, 14);
  if (!imuValid) return;

  const float x = signedWord(bytes[0], bytes[1]) / 16384.0f;
  const float y = signedWord(bytes[2], bytes[3]) / 16384.0f;
  const float z = signedWord(bytes[4], bytes[5]) / 16384.0f;
  const float rx = signedWord(bytes[8], bytes[9]) / 131.0f;
  const float ry = signedWord(bytes[10], bytes[11]) / 131.0f;
  const float rz = signedWord(bytes[12], bytes[13]) / 131.0f;

  const float jerk = fabsf(x - ax) + fabsf(y - ay) + fabsf(z - az);
  const float gyroMagnitude = fmaxf(fabsf(rx),
                               fmaxf(fabsf(ry), fabsf(rz)));
  if (jerk > 0.18f || gyroMagnitude > 50.0f)
    motionBlockUntilMs = now + 1500;

  ax = x; ay = y; az = z;
  gx = rx; gy = ry; gz = rz;
}

// -------------------- DS18B20 --------------------
void startTemperature() {
  if (!temperatureReady) return;
  thermometer.requestTemperatures();  // configured as non-blocking
  temperatureStartedMs = millis();
  temperaturePending = true;
}

void updateTemperature() {
  if (!temperatureReady) return;
  const uint32_t now = millis();
  if (temperaturePending) {
    if ((uint32_t)(now - temperatureStartedMs) < 800) return;
    const float c = thermometer.getTempC(temperatureAddress);
    temperatureValid = c != DEVICE_DISCONNECTED_C
                    && isfinite(c) && c >= -55.0f && c <= 125.0f;
    if (temperatureValid) temperatureC = c;
    temperaturePending = false;
  } else if ((uint32_t)(now - temperatureStartedMs) >= 1100) {
    startTemperature();
  }
}

// -------------------- Vibration --------------------
void stopMotor() {
  digitalWrite(MOTOR_PIN, LOW);
  motorOn = false;
}

void updateMotor() {
  const uint32_t now = millis();
  if (serverVibrate && (uint32_t)(now - serverVibrateAtMs) < ALARM_STALE_MS) {
    // Pulse 500 ms on / 500 ms off until a caregiver accepts the alarm.
    const bool on = (now / ALARM_PULSE_MS) % 2 == 0;
    digitalWrite(MOTOR_PIN, on ? HIGH : LOW);
    motorOn = on;
    alarmDriving = true;
    return;
  }
  if (alarmDriving) {
    stopMotor();
    alarmDriving = false;
  }
  if (motorOn && (uint32_t)(millis() - motorStartedMs) >= 2000) {
    stopMotor();
    Serial0.println("# VIBRATION STOPPED");
  }
}

// -------------------- FIFO acquisition --------------------
void clearHeartHistory() {
  historyHead = 0;
  historyCount = 0;
  downsamplePhase = 0;
  filterReady = false;
  baselineIR = baselineRED = 0.0f;
  filteredIR = filteredRED = 0.0f;
  heartValid = false;
  heartBPM = 0;
  heartRMS = heartPeriodicity = heartChannelCorrelation = 0.0f;
  heartStatus = "WARMUP";
  rawIR = rawRED = 0;
  lastOpticalMs = 0;
  lastHeartUpdateMs = millis();
}

void processSample(uint32_t red, uint32_t ir) {
  totalSamples++;
  rawIR = ir;
  rawRED = red;
  lastOpticalMs = millis();

  if (!filterReady) {
    baselineIR = (float)ir;
    baselineRED = (float)red;
    filterReady = true;
  }
  // 100-106 Hz stream: remove slow DC, suppress high-frequency noise.
  baselineIR += 0.027f * ((float)ir - baselineIR);
  baselineRED += 0.027f * ((float)red - baselineRED);
  filteredIR += 0.21f * (((float)ir - baselineIR) - filteredIR);
  filteredRED += 0.21f * (((float)red - baselineRED) - filteredRED);

  if (++downsamplePhase >= DOWNSAMPLE) {
    downsamplePhase = 0;
    irHistory[historyHead] = filteredIR;
    redHistory[historyHead] = filteredRED;
    historyHead = (historyHead + 1) % HISTORY_CAPACITY;
    if (historyCount < HISTORY_CAPACITY) historyCount++;
  }

  if (csvRecording) {
    Serial0.print(recordingSamples++);
    Serial0.print(',');
    Serial0.print(micros());  // Read timestamp, NOT true conversion timestamp
    Serial0.print(',');
    Serial0.print(red);
    Serial0.print(',');
    Serial0.println(ir);
  }
}

// Read exactly ONE RED+IR record (6 bytes) per I2C transaction.
// This is the method already validated on this ESP32-S3 with 30-s
// finger.csv and wrist.csv recordings.  Do not use the SparkFun
// 4-record software ring buffer here.
bool readOneFIFORecord(uint32_t &red, uint32_t &ir) {
  uint8_t b[6];
  if (!readRegisterBlock(PPG_ADDR, 0x07, b, sizeof(b))) return false;
  red = ((((uint32_t)b[0]) << 16) | (((uint32_t)b[1]) << 8) | b[2]) & 0x3FFFFUL;
  ir  = ((((uint32_t)b[3]) << 16) | (((uint32_t)b[4]) << 8) | b[5]) & 0x3FFFFUL;
  return true;
}

void serviceOpticalFIFO() {
  if (!opticalReady) return;

  // Poll fast enough that a 32-slot FIFO (~320 ms at 100 SPS)
  // should never fill during normal operation.
  const uint32_t nowUs = micros();
  if ((uint32_t)(nowUs - lastPPGPollUs) < 2500UL) return;
  lastPPGPollUs = nowUs;

  uint8_t ptr[3];
  if (!readRegisterBlock(PPG_ADDR, 0x04, ptr, 3)) {
    i2cErrors++;
    return;
  }

  const uint8_t wr  = ptr[0] & 0x1F;
  const uint8_t ovf = ptr[1] & 0x1F;
  const uint8_t rd  = ptr[2] & 0x1F;
  lastFIFOWritePtr = wr;
  lastFIFOReadPtr = rd;
  lastFIFOOverflowRegister = ovf;

  // Important MAX30102 behavior: a *successful sample pop* resets
  // OVF_COUNTER. Old V2 cleared all pointers BEFORE attempting to read,
  // and then repeated the recovery path hundreds of times per second.
  if (ovf == 0) {
    fifoOverflowLatched = false;
  } else if (!fifoOverflowLatched) {
    fifoOverflowLatched = true;
    fifoOverflows++;  // Incident count, NOT lost-sample count!
    clearHeartHistory();  // Do not use interrupted PPG history.
    rateCountStart = totalSamples;
    rateTimeStartUs = micros();
    lastRateUpdateMs = millis();
    if ((uint32_t)(millis() - lastOverflowNoticeMs) >= 5000UL ||
        lastOverflowNoticeMs == 0) {
      lastOverflowNoticeMs = millis();
      Serial0.print("# FIFO incident (hardware OVF register=");
      Serial0.print(ovf);
      Serial0.println("); attempting normal FIFO reads");
    }
  }

  uint8_t available = (uint8_t)((wr - rd) & 0x1F);

  // With a full FIFO, pointers can be equal. If the overflow counter
  // is nonzero, try popping at least one record, not clearing the FIFO.
  if (available == 0 && ovf != 0) available = 1;

  if (available > 12) available = 12;
  for (uint8_t n = 0; n < available; ++n) {
    uint32_t red = 0, ir = 0;
    if (!readOneFIFORecord(red, ir)) {
      i2cErrors++;
      return;
    }
    fifoReadSamples++;
    processSample(red, ir);
  }
}

void updateOpticalRate() {
  if (!opticalReady) return;
  const uint32_t now = millis();
  if ((uint32_t)(now - lastRateUpdateMs) < 5000UL) return;
  lastRateUpdateMs = now;
  const uint32_t t = micros();
  const uint32_t elapsed = t - rateTimeStartUs;
  const uint32_t samples = totalSamples - rateCountStart;
  rateTimeStartUs = t;
  rateCountStart = totalSamples;
  if (elapsed < 2000000UL || samples < 100) return;
  const float fs = 1000000.0f * (float)samples / (float)elapsed;
  if (fs >= 75.0f && fs <= 145.0f) opticalSampleRate = fs;
}

// -------------------- Real BPM: fast downsampled autocorrelation --------------------
void updateHeartRate() {
  if (!opticalReady) {
    heartValid = false;
    heartStatus = "NO_SENSOR";
    return;
  }
  const uint32_t now = millis();
  if ((uint32_t)(now - lastHeartUpdateMs) < 1000UL) return;
  lastHeartUpdateMs = now;
  heartValid = false;
  heartStatus = "WARMUP";

  if ((uint32_t)(now - lastOpticalMs) > 1000UL) {
    heartStatus = "NO_SAMPLES";
    return;
  }
  if (rawIR < 4000UL || rawRED < 3000UL) {
    heartStatus = "NO_CONTACT";
    return;
  }
  if (rawIR > 250000UL || rawRED > 250000UL) {
    heartStatus = "SATURATED";
    return;
  }
  if (imuReady && (int32_t)(now - motionBlockUntilMs) < 0) {
    heartStatus = "MOTION";
    return;
  }

  const float analysisRate = opticalSampleRate / (float)DOWNSAMPLE;
  uint16_t length = (uint16_t)(analysisRate * 7.0f + 0.5f);
  if (length < 150) length = 150;
  if (length > ANALYSIS_CAPACITY) length = ANALYSIS_CAPACITY;
  if (historyCount < length) return;

  uint16_t start = (historyHead + HISTORY_CAPACITY - length) % HISTORY_CAPACITY;
  float sumIR = 0, sumRED = 0;
  for (uint16_t i = 0; i < length; i++) {
    uint16_t k = (start + i) % HISTORY_CAPACITY;
    analysisIR[i] = irHistory[k];
    sumIR += irHistory[k];
    sumRED += redHistory[k];
  }
  const float irMean = sumIR / length;
  const float redMean = sumRED / length;

  float irEnergy = 0, redEnergy = 0, cross = 0;
  for (uint16_t i = 0; i < length; i++) {
    uint16_t k = (start + i) % HISTORY_CAPACITY;
    const float a = analysisIR[i] - irMean;
    const float b = redHistory[k] - redMean;
    analysisIR[i] = a;
    irEnergy += a * a;
    redEnergy += b * b;
    cross += a * b;
  }
  heartRMS = sqrtf(irEnergy / length);
  const float redRMS = sqrtf(redEnergy / length);
  heartChannelCorrelation = cross / sqrtf(irEnergy * redEnergy + 1e-6f);

  if (heartRMS < 6.0f || redRMS < 2.0f) {
    heartStatus = "WEAK_SIGNAL";
    return;
  }
  if (heartChannelCorrelation < 0.53f) {
    heartStatus = "LOW_RED_IR_AGREEMENT";
    return;
  }

  int minLag = (int)(analysisRate * 60.0f / 170.0f);
  int maxLag = (int)(analysisRate * 60.0f / 45.0f);
  if (minLag < 2) minLag = 2;
  if (maxLag > (int)length / 3) maxLag = (int)length / 3;
  if (maxLag <= minLag) {
    heartStatus = "INVALID_RATE";
    return;
  }

  float bestScore = -1.0f;
  int bestLag = 0;
  float previousScore = 0, bestLeft = 0, bestRight = 0;
  for (int lag = minLag; lag <= maxLag; lag++) {
    float dot = 0, leftPower = 0, rightPower = 0;
    const int count = (int)length - lag;
    for (int i = 0; i < count; i++) {
      const float a = analysisIR[i];
      const float b = analysisIR[i + lag];
      dot += a * b;
      leftPower += a * a;
      rightPower += b * b;
    }
    const float score = dot / sqrtf(leftPower * rightPower + 1e-6f);
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
      bestLeft = previousScore;
      bestRight = score;  // overwritten on following lag
    } else if (lag == bestLag + 1) {
      bestRight = score;
    }
    previousScore = score;
  }
  heartPeriodicity = bestScore;
  if (bestLag < minLag || bestScore < 0.52f) {
    heartStatus = "NO_RELIABLE_PERIOD";
    return;
  }

  // Sub-sample parabolic interpolation makes 25-Hz analysis less quantized.
  float interpolatedLag = (float)bestLag;
  if (bestLag > minLag && bestLag < maxLag) {
    const float denominator = bestLeft - 2.0f * bestScore + bestRight;
    if (fabsf(denominator) > 1e-6f) {
      float fraction = 0.5f * (bestLeft - bestRight) / denominator;
      if (fraction > 0.5f) fraction = 0.5f;
      if (fraction < -0.5f) fraction = -0.5f;
      interpolatedLag += fraction;
    }
  }
  const float candidate = 60.0f * analysisRate / interpolatedLag;
  if (!isfinite(candidate) || candidate < 45.0f || candidate > 170.0f) {
    heartStatus = "INVALID_PERIOD";
    return;
  }

  if (heartBPM > 0.0f && fabsf(candidate - heartBPM) < 18.0f)
    heartBPM = 0.35f * heartBPM + 0.65f * candidate;
  else
    heartBPM = candidate;
  heartValid = true;
  heartStatus = "VALID";
}

// -------------------- Interactive serial commands --------------------
void startRecording() {
  if (!opticalReady) {
    Serial0.println("# ERROR: MAX30102 NOT READY");
    return;
  }
  if (csvRecording) {
    Serial0.println("# Already recording");
    return;
  }
  // Clear only FIFO; do not change sensor settings.
  // Explicitly restart a CSV segment with an empty FIFO.
  optical.clearFIFO();
  fifoClearCount++;
  fifoOverflowLatched = false;
  clearHeartHistory();
  rateCountStart = totalSamples;
  rateTimeStartUs = micros();
  lastRateUpdateMs = millis();
  recordingSamples = 0;
  recordingErrorsStart = i2cErrors;
  recordingOverflowStart = fifoOverflows;
  csvRecording = true;

  Serial0.println();
  Serial0.println("# RECORDING STARTED");
  Serial0.println("# REAL RED/IR DATA; NO SIMULATED BPM");
  Serial0.println("# read_us is FIFO read time; not true optical conversion time");
  Serial0.println("seq,read_us,red,ir");
}

void stopRecording() {
  if (!csvRecording) {
    Serial0.println("# Not recording");
    return;
  }
  csvRecording = false;
  Serial0.println();
  Serial0.println("# RECORDING STOPPED");
  Serial0.print("# Total samples: "); Serial0.println(recordingSamples);
  Serial0.print("# I2C errors: "); Serial0.println(i2cErrors - recordingErrorsStart);
  Serial0.print("# FIFO overflow events: ");
  Serial0.println(fifoOverflows - recordingOverflowStart);
  Serial0.println("# Live sensor monitoring continues");
  Serial0.println("# Send 1 to start again");
}

void handleCommands() {
  while (Serial0.available() > 0) {
    const char command = (char)Serial0.read();
    if (command == '1') {
      startRecording();
    } else if (command == 'q' || command == 'Q') {
      stopRecording();
    } else if (command == 'v' || command == 'V') {
      digitalWrite(MOTOR_PIN, HIGH);
      motorOn = true;
      motorStartedMs = millis();
      motionBlockUntilMs = millis() + 5500;
      Serial0.println("# VIBRATION ON FOR 2 SECONDS");
    } else if (command == 's' || command == 'S') {
      stopMotor();
      Serial0.println("# VIBRATION OFF");
    }
    // CR/LF from Serial Monitor are ignored.
  }
}

// -------------------- Backend telemetry --------------------
// One JSON snapshot per second to SERVER_URL (POST /api/telemetry). HTTP runs in its own task on
// core 0, so loop() and the PPG FIFO polling on core 1 are never blocked by the network.
const char *DEVICE_ID = "guardian-001";  // must match DEVICE_ID in apps/api/.env
constexpr uint32_t SEND_INTERVAL_MS = 1000;
constexpr uint16_t HTTP_TIMEOUT_MS = 800;

struct Telemetry {
  uint32_t seq, uptimeMs;
  bool heartValid; float heartBPM; const char *heartStatus;
  bool temperatureValid; float temperatureC;
  bool imuValid; float ax, ay, az, gx, gy, gz;
};
QueueHandle_t telemetryQueue = nullptr;
uint32_t telemetrySeq = 0;
uint32_t lastSendMs = 0;
volatile int lastHttpCode = 0;
volatile uint32_t sentOk = 0, sentFailed = 0;

void senderTask(void *) {
  Telemetry t;
  static char body[512];
  static HTTPClient http;  // kept alive: one TCP connection instead of a new one per second
  http.setReuse(true);
  for (;;) {
    if (xQueueReceive(telemetryQueue, &t, portMAX_DELAY) != pdTRUE) continue;
    if (WiFi.status() != WL_CONNECTED) { lastHttpCode = -100; sentFailed++; continue; }
    char bpm[16] = "null", temp[16] = "null", imu[160] = "null";
    if (t.heartValid) snprintf(bpm, sizeof(bpm), "%.1f", t.heartBPM);
    if (t.temperatureValid) snprintf(temp, sizeof(temp), "%.2f", t.temperatureC);
    if (t.imuValid) snprintf(imu, sizeof(imu),
        "{\"x\":%.3f,\"y\":%.3f,\"z\":%.3f}", t.ax, t.ay, t.az);
    char gyro[96] = "null";
    if (t.imuValid) snprintf(gyro, sizeof(gyro),
        "{\"x\":%.2f,\"y\":%.2f,\"z\":%.2f}", t.gx, t.gy, t.gz);
    snprintf(body, sizeof(body),
        "{\"deviceId\":\"%s\",\"firmware\":\"V3\",\"seq\":%lu,\"uptimeMs\":%lu,"
        "\"heart\":{\"valid\":%s,\"bpm\":%s,\"status\":\"%s\"},"
        "\"temperature\":{\"valid\":%s,\"celsius\":%s},"
        "\"imu\":{\"valid\":%s,\"accel\":%s,\"gyro\":%s},"
        "\"device\":{\"wifiRssi\":%ld}}",
        DEVICE_ID, (unsigned long)t.seq, (unsigned long)t.uptimeMs,
        t.heartValid ? "true" : "false", bpm, t.heartStatus,
        t.temperatureValid ? "true" : "false", temp,
        t.imuValid ? "true" : "false", imu, gyro, (long)WiFi.RSSI());
    http.setConnectTimeout(HTTP_TIMEOUT_MS);
    http.setTimeout(HTTP_TIMEOUT_MS);
    if (!http.begin(SERVER_URL)) { lastHttpCode = -102; sentFailed++; continue; }
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-key", API_KEY);
    const int code = http.POST((uint8_t *)body, strlen(body));
    if (code >= 200 && code < 300) {
      // Small JSON answer: {"ok":true,"receivedAt":"...","vibrate":true|false}
      const String answer = http.getString();
      serverVibrate = answer.indexOf("\"vibrate\":true") >= 0;
      serverVibrateAtMs = millis();
    }
    http.end();
    lastHttpCode = code;
    if (code >= 200 && code < 300) sentOk++; else sentFailed++;
  }
}

void queueTelemetry() {
  if (!telemetryQueue) return;
  Telemetry t = { telemetrySeq++, millis(), heartValid, heartBPM, heartStatus,
                  temperatureValid, temperatureC, imuValid, ax, ay, az, gx, gy, gz };
  xQueueOverwrite(telemetryQueue, &t);  // queue of 1: an unsent older snapshot is replaced
}

void startNetwork() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);  // modem sleep pulses the supply current; keep it steady for the PPG
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  WiFi.setTxPower(WIFI_POWER_8_5dBm);  // lower TX current peaks; enough for a nearby hotspot
  Serial0.print("# WIFI CONNECTING TO "); Serial0.println(WIFI_SSID);
  Serial0.print("# BACKEND: "); Serial0.println(SERVER_URL);
  telemetryQueue = xQueueCreate(1, sizeof(Telemetry));
  if (telemetryQueue) xTaskCreatePinnedToCore(senderTask, "telemetry", 8192, nullptr, 1, nullptr, 0);
}

// -------------------- Monitor output --------------------
void printStatus() {
  // Lines prefixed '#' are ignored by the existing Mac record.py parser.
  if (csvRecording) Serial0.print("# ");
  Serial0.print("BPM:");
  if (heartValid) Serial0.print(heartBPM, 1);
  else Serial0.print("--");
  Serial0.print(" HR_STATUS:"); Serial0.print(heartStatus);
  Serial0.print(" | IR:");
  if (opticalReady && (uint32_t)(millis() - lastOpticalMs) < 500)
    Serial0.print(rawIR);
  else
    Serial0.print("--");
  Serial0.print(" | PPG_RMS:"); Serial0.print(heartRMS, 1);
  Serial0.print(" | PERIOD:"); Serial0.print(heartPeriodicity, 2);
  Serial0.print(" | RED_IR_CORR:"); Serial0.print(heartChannelCorrelation, 2);
  Serial0.print(" | RATE:"); Serial0.print(opticalSampleRate, 1);
  Serial0.print(" | TempC:");
  if (temperatureValid) Serial0.print(temperatureC, 2);
  else Serial0.print("--");
  Serial0.print(" | IMU:");
  if (imuValid) {
    Serial0.print("OK AX:"); Serial0.print(ax, 2);
    Serial0.print(" AY:"); Serial0.print(ay, 2);
    Serial0.print(" AZ:"); Serial0.print(az, 2);
    Serial0.print(" GX:"); Serial0.print(gx, 1);
    Serial0.print(" GY:"); Serial0.print(gy, 1);
    Serial0.print(" GZ:"); Serial0.print(gz, 1);
  } else Serial0.print("ERROR");
  Serial0.print(" | Motor:"); Serial0.print(motorOn ? "ON" : "OFF");
  Serial0.print(" | I2C_ERR:"); Serial0.print(i2cErrors);
  Serial0.print(" | FIFO_OVF:"); Serial0.print(fifoOverflows);
  Serial0.print(" | PPG_SAMPLES:"); Serial0.print(totalSamples);
  Serial0.print(" | FIFO_WR:"); Serial0.print(lastFIFOWritePtr);
  Serial0.print(" | FIFO_RD:"); Serial0.print(lastFIFOReadPtr);
  Serial0.print(" | HW_OVF:"); Serial0.print(lastFIFOOverflowRegister);
  Serial0.print(" | WIFI:"); Serial0.print(WiFi.status() == WL_CONNECTED ? "OK" : "--");
  Serial0.print(" | HTTP:"); Serial0.print(lastHttpCode);
  Serial0.print(" ok:"); Serial0.print(sentOk);
  Serial0.print(" fail:"); Serial0.println(sentFailed);
}

// -------------------- Arduino setup and loop --------------------
void setup() {
  digitalWrite(MOTOR_PIN, LOW);
  pinMode(MOTOR_PIN, OUTPUT);
  Serial0.begin(BAUD);
  delay(1200);
  Serial0.println();
  Serial0.println("=========================================");
  Serial0.println("GuardianCare Hand-Back Integrated V3");
  Serial0.println("ESP32-S3-N16R8 | COM/UART0 | 115200");
  Serial0.println("REAL BPM ONLY; no DEMO_BPM");
  Serial0.println("=========================================");

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000); // Previously confirmed stable with this wiring
  Wire.setTimeOut(100);

  imuReady = initializeIMU();
  Serial0.println(imuReady ? "# IMU READY" : "# IMU NOT FOUND");

  thermometer.begin();
  temperatureReady = thermometer.getAddress(temperatureAddress, 0);
  if (temperatureReady) {
    thermometer.setResolution(temperatureAddress, 12);
    thermometer.setWaitForConversion(false);
    Serial0.println("# DS18B20 READY");
    startTemperature();
  } else Serial0.println("# DS18B20 NOT FOUND");

  opticalReady = optical.begin(Wire, I2C_SPEED_STANDARD);
  if (opticalReady) {
    optical.setup(LED_CURRENT, LED_AVERAGE, LED_MODE,
                  PPG_RATE_SETTING, PPG_PULSE_WIDTH, PPG_ADC_RANGE);
    optical.disableFIFORollover();
    optical.wakeUp();
    optical.clearFIFO();
    fifoClearCount++;
    Serial0.println("# MAX30102 READY - PROVEN 6-BYTE FIFO READ");
    Serial0.println("# HAND-BACK WEAK SIGNAL MODE");
  } else Serial0.println("# MAX30102 NOT FOUND");

  // WiFi connects in the background; loop() does not wait for it.
  startNetwork();
  if (opticalReady) optical.clearFIFO();  // WiFi start-up may have taken a moment

  clearHeartHistory();
  rateCountStart = totalSamples;
  rateTimeStartUs = micros();
  lastRateUpdateMs = millis();
  lastIMUMs = millis();
  lastPrintMs = millis();
  Serial0.println("# Commands: 1=start CSV, q=stop CSV, v=vibrate, s=stop");
  Serial0.println("# BPM requires around 10-15s of stationary data");
  Serial0.println("# BPM:-- means unreliable signal; not zero heart rate");
  Serial0.println("# READY");
}

void loop() {
  // Critical: service FIFO BEFORE slower peripheral operations.
  serviceOpticalFIFO();
  handleCommands();
  updateIMU();
  updateTemperature();
  updateMotor();
  updateOpticalRate();
  updateHeartRate();
  serviceOpticalFIFO(); // service once more after analysis

  const uint32_t now = millis();
  if ((uint32_t)(now - lastSendMs) >= SEND_INTERVAL_MS) {
    lastSendMs = now;
    queueTelemetry();  // copies a struct; never blocks
  }
  if ((uint32_t)(now - lastPrintMs) >= 1000UL) {
    lastPrintMs = now;
    printStatus();
  }
  delay(1);
}
