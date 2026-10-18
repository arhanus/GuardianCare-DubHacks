# ESP32-S3 Wristband Firmware

No firmware yet. Place the Arduino sketch in `hardware/esp32/guardiancare_wristband/`.

- **Setup:** Arduino IDE 2.x, ESP32 board package (Espressif), board "ESP32S3 Dev Module". Libraries: MAX30105/MAX30102 driver, MPU6050, TMP117 (optional), WiFi, HTTPClient (HTTPS).
- **Hardware:** MAX30102 (heart rate), MPU6050 (motion), TMP117 (optional), SOS button (GPIO, debounced, interrupt/INPUT_PULLUP). No display.
- **Network:** Wi-Fi to backend HTTPS API. Sync time via NTP. Retry with the same `eventId` on failure (backend is idempotent).
- **Contract:** `POST /api/devices/events` and `/api/devices/readings`; see `docs/API_CONTRACT.md`. Example event: `{"eventId":"guardian-001-evt-123","deviceId":"guardian-001","eventType":"SOS","timestamp":"2026-10-17T12:00:00Z"}`
- **Auth:** header `x-device-key`. Keep credentials in an untracked `secrets.h`, never in Git.
- **Testing:** 1) `curl` the deployed/LAN `/api/health`. 2) Fire a fake SOS with curl. 3) Flash firmware, press button, watch serial log + backend log. 4) Confirm alert appears in app.


Current Ardunio Code:

#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <MAX30105.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <math.h>

// ==================== Network settings ====================
// Kendi bilgilerinizle degistirin.

const char *WIFI_SSID     = "kim_guest";
const char *WIFI_PASSWORD = "It.passes.through";

// Ornek: "http://192.168.1.50:3000/api/telemetry"
const char *SERVER_URL = "http://192.168.1.50:3000/api/telemetry";

// Bos birakilirsa X-API-Key basligi gonderilmez.
const char *API_KEY = "";

const char *DEVICE_ID = "proto-01";

constexpr uint32_t SEND_INTERVAL_MS = 1000;
constexpr uint16_t HTTP_TIMEOUT_MS  = 800;

// ==================== Connections ====================

constexpr int SDA_PIN = 8;
constexpr int SCL_PIN = 9;
constexpr int TEMP_PIN = 4;
constexpr int MOTOR_PIN = 5;

constexpr uint8_t IMU_ADDRESS = 0x68;

// ==================== Devices ====================

MAX30105 opticalSensor;

OneWire oneWire(TEMP_PIN);
DallasTemperature thermometer(&oneWire);
DeviceAddress temperatureAddress;

// ==================== Device status ====================

bool imuReady = false;
bool imuDataValid = false;

bool opticalReady = false;
bool opticalDataReceived = false;

bool temperatureReady = false;
bool temperatureValid = false;

// ==================== Real sensor measurements ====================

float ax = 0;
float ay = 0;
float az = 0;

float gx = 0;
float gy = 0;
float gz = 0;

float temperatureC = 0;
uint32_t rawIR = 0;

// ==================== Simulated BPM ====================
// This is generated demo data, NOT a sensor measurement.

float demoBPM = 79.0f;
uint32_t lastDemoUpdateMs = 0;

// ==================== Timing ====================

uint32_t lastIMUMs = 0;
uint32_t lastOpticalDataMs = 0;
uint32_t lastPrintMs = 0;
uint32_t lastSendMs = 0;

uint32_t temperatureStartMs = 0;
bool temperaturePending = false;

uint32_t motorStartMs = 0;
bool motorOn = false;

// ==================== Telemetry (network) ====================

struct Telemetry {
  uint32_t seq;
  uint32_t uptimeMs;

  float bpm;

  bool temperatureValid;
  float temperatureC;

  bool opticalValid;
  uint32_t rawIR;

  bool imuValid;
  float ax, ay, az;
  float gx, gy, gz;

  bool motorOn;
};

QueueHandle_t telemetryQueue = nullptr;
uint32_t telemetrySeq = 0;

// Written by the sender task, read by the main loop for display.
volatile int lastHttpCode = 0;
volatile uint32_t sentOk = 0;
volatile uint32_t sentFailed = 0;

// ==================== IMU communication ====================

bool writeIMU(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(IMU_ADDRESS);
  Wire.write(reg);
  Wire.write(value);

  return Wire.endTransmission() == 0;
}

bool readIMURegisters(uint8_t reg, uint8_t *data, uint8_t count) {
  Wire.beginTransmission(IMU_ADDRESS);
  Wire.write(reg);

  if (Wire.endTransmission(false) != 0) {
    return false;
  }

  size_t received = Wire.requestFrom(IMU_ADDRESS, count);

  if (received != count) {
    while (Wire.available()) {
      Wire.read();
    }
    return false;
  }

  for (uint8_t i = 0; i < count; i++) {
    data[i] = Wire.read();
  }

  return true;
}

int16_t signedWord(uint8_t highByte, uint8_t lowByte) {
  return (int16_t)(((uint16_t)highByte << 8) | lowByte);
}

bool writeIMUChecked(uint8_t reg, uint8_t value) {
  for (int attempt = 0; attempt < 3; attempt++) {
    if (writeIMU(reg, value)) {
      delay(10);
      return true;
    }

    delay(30);
  }

  Serial.print("IMU register write failed: 0x");
  Serial.println(reg, HEX);

  return false;
}

// ==================== IMU initialization ====================

bool initializeIMU() {
  uint8_t identity = 0;

  if (!readIMURegisters(0x75, &identity, 1)) {
    Serial.println("IMU identity read failed.");
    return false;
  }

  Serial.print("IMU identity: 0x");
  Serial.println(identity, HEX);

  if (identity != 0x70 && identity != 0x68) {
    Serial.println("Unsupported IMU identity.");
    return false;
  }

  // Reset, then allow recovery.
  writeIMU(0x6B, 0x80);
  delay(300);

  // Wake sensor.
  if (!writeIMUChecked(0x6B, 0x01)) return false;
  delay(100);

  uint8_t checkIdentity = 0;

  if (!readIMURegisters(0x75, &checkIdentity, 1) ||
      checkIdentity != identity) {
    Serial.println("IMU identity check after reset failed.");
    return false;
  }

  // Enable all axes.
  if (!writeIMUChecked(0x6C, 0x00)) return false;

  // Filter and sample rate.
  if (!writeIMUChecked(0x1A, 0x03)) return false;
  if (!writeIMUChecked(0x19, 0x09)) return false;

  // Gyroscope: +/-250 degrees/second.
  if (!writeIMUChecked(0x1B, 0x00)) return false;

  // Accelerometer: +/-2 g.
  if (!writeIMUChecked(0x1C, 0x00)) return false;

  if (identity == 0x70) {
    if (!writeIMUChecked(0x1D, 0x03)) return false;
  }

  uint8_t powerState = 0;

  return readIMURegisters(0x6B, &powerState, 1) &&
         !(powerState & 0x40);
}

// ==================== Real IMU reading ====================

void updateIMU() {
  if (!imuReady) return;

  uint32_t now = millis();

  if ((uint32_t)(now - lastIMUMs) < 20) return;
  lastIMUMs = now;

  uint8_t data[14];

  imuDataValid = readIMURegisters(0x3B, data, 14);

  if (!imuDataValid) return;

  ax = signedWord(data[0], data[1]) / 16384.0f;
  ay = signedWord(data[2], data[3]) / 16384.0f;
  az = signedWord(data[4], data[5]) / 16384.0f;

  gx = signedWord(data[8], data[9]) / 131.0f;
  gy = signedWord(data[10], data[11]) / 131.0f;
  gz = signedWord(data[12], data[13]) / 131.0f;
}

// ==================== Real optical reading ====================

void updateOptical() {
  if (!opticalReady) return;

  uint16_t received = opticalSensor.check();

  // Discard batches that could overwrite the library's
  // small software buffer.
  if (received >= 4) {
    while (opticalSensor.available()) {
      opticalSensor.nextSample();
    }

    opticalSensor.clearFIFO();
    opticalDataReceived = false;
    return;
  }

  while (opticalSensor.available()) {
    rawIR = opticalSensor.getFIFOIR();
    opticalSensor.nextSample();

    lastOpticalDataMs = millis();
    opticalDataReceived = true;
  }
}

bool isOpticalFresh() {
  return opticalReady &&
         opticalDataReceived &&
         (uint32_t)(millis() - lastOpticalDataMs) < 500;
}

// ==================== Real temperature reading ====================

void startTemperatureConversion() {
  if (!temperatureReady) return;

  thermometer.requestTemperatures();

  temperatureStartMs = millis();
  temperaturePending = true;
}

void updateTemperature() {
  if (!temperatureReady) return;

  uint32_t now = millis();

  if (!temperaturePending) {
    if ((uint32_t)(now - temperatureStartMs) >= 1000) {
      startTemperatureConversion();
    }

    return;
  }

  // Nonblocking wait for 12-bit conversion.
  if ((uint32_t)(now - temperatureStartMs) < 800) {
    return;
  }

  float value = thermometer.getTempC(temperatureAddress);

  temperatureValid =
      value != DEVICE_DISCONNECTED_C &&
      isfinite(value) &&
      value >= -55.0f &&
      value <= 125.0f;

  if (temperatureValid) {
    temperatureC = value;
  }

  temperaturePending = false;
}

// ==================== Simulated BPM ====================

void updateDemoBPM() {
  uint32_t now = millis();

  if ((uint32_t)(now - lastDemoUpdateMs) < 1000) {
    return;
  }

  lastDemoUpdateMs = now;

  float seconds = now / 1000.0f;

  float target =
      80.0f +
      6.0f * sinf(seconds * 0.055f) +
      1.5f * sinf(seconds * 0.31f) +
      random(-5, 6) * 0.1f;

  demoBPM += 0.25f * (target - demoBPM);
}

// ==================== Vibration control ====================

void stopMotor() {
  digitalWrite(MOTOR_PIN, LOW);
  motorOn = false;
}

void updateMotorAndCommands() {
  while (Serial.available()) {
    char command = Serial.read();

    if (command == 'v' || command == 'V') {
      motorOn = true;
      motorStartMs = millis();

      digitalWrite(MOTOR_PIN, HIGH);
      Serial.println("Vibration ON for 2 seconds.");
    } else if (command == 's' || command == 'S') {
      stopMotor();
      Serial.println("Vibration OFF.");
    }
  }

  if (motorOn &&
      (uint32_t)(millis() - motorStartMs) >= 2000) {
    stopMotor();
    Serial.println("Vibration test finished.");
  }
}

// ==================== JSON building ====================

// Appends formatted text to buf; returns false if it would overflow.
bool appendf(char *buf, size_t size, size_t &len, const char *fmt, ...) {
  if (len >= size) return false;

  va_list args;
  va_start(args, fmt);
  int n = vsnprintf(buf + len, size - len, fmt, args);
  va_end(args);

  if (n < 0 || (size_t)n >= size - len) {
    len = size;
    return false;
  }

  len += n;
  return true;
}

bool buildJson(const Telemetry &t, char *buf, size_t size) {
  size_t len = 0;
  bool ok = true;

  ok &= appendf(buf, size, len,
      "{\"deviceId\":\"%s\",\"seq\":%lu,\"uptimeMs\":%lu,",
      DEVICE_ID,
      (unsigned long)t.seq,
      (unsigned long)t.uptimeMs);

  ok &= appendf(buf, size, len,
      "\"bpm\":{\"value\":%.1f,\"source\":\"SIMULATED\"},",
      t.bpm);

  if (t.temperatureValid) {
    ok &= appendf(buf, size, len,
        "\"temperature\":{\"valid\":true,\"celsius\":%.2f},",
        t.temperatureC);
  } else {
    ok &= appendf(buf, size, len,
        "\"temperature\":{\"valid\":false,\"celsius\":null},");
  }

  if (t.opticalValid) {
    ok &= appendf(buf, size, len,
        "\"optical\":{\"valid\":true,\"rawIR\":%lu},",
        (unsigned long)t.rawIR);
  } else {
    ok &= appendf(buf, size, len,
        "\"optical\":{\"valid\":false,\"rawIR\":null},");
  }

  if (t.imuValid) {
    ok &= appendf(buf, size, len,
        "\"imu\":{\"valid\":true,"
        "\"accel\":{\"x\":%.3f,\"y\":%.3f,\"z\":%.3f},"
        "\"gyro\":{\"x\":%.2f,\"y\":%.2f,\"z\":%.2f}},",
        t.ax, t.ay, t.az, t.gx, t.gy, t.gz);
  } else {
    ok &= appendf(buf, size, len,
        "\"imu\":{\"valid\":false,\"accel\":null,\"gyro\":null},");
  }

  ok &= appendf(buf, size, len,
      "\"motorOn\":%s}",
      t.motorOn ? "true" : "false");

  return ok;
}

// ==================== Network sender task ====================
// HTTP runs in its own task so a slow server never blocks
// sensor reading in loop().

void senderTask(void *) {
  Telemetry t;
  char body[512];

  for (;;) {
    if (xQueueReceive(telemetryQueue, &t, portMAX_DELAY) != pdTRUE) {
      continue;
    }

    if (WiFi.status() != WL_CONNECTED) {
      lastHttpCode = -100;  // no WiFi
      sentFailed++;
      continue;
    }

    if (!buildJson(t, body, sizeof(body))) {
      lastHttpCode = -101;  // JSON buffer too small
      sentFailed++;
      continue;
    }

    HTTPClient http;
    http.setConnectTimeout(HTTP_TIMEOUT_MS);
    http.setTimeout(HTTP_TIMEOUT_MS);

    if (!http.begin(SERVER_URL)) {
      lastHttpCode = -102;  // bad URL
      sentFailed++;
      continue;
    }

    http.addHeader("Content-Type", "application/json");

    if (API_KEY[0] != '\0') {
      http.addHeader("X-API-Key", API_KEY);
    }

    int code = http.POST((uint8_t *)body, strlen(body));
    http.end();

    lastHttpCode = code;

    if (code >= 200 && code < 300) {
      sentOk++;
    } else {
      sentFailed++;
    }
  }
}

void queueTelemetry() {
  if (!telemetryQueue) return;

  Telemetry t;

  t.seq = telemetrySeq++;
  t.uptimeMs = millis();

  t.bpm = demoBPM;

  t.temperatureValid = temperatureValid;
  t.temperatureC = temperatureC;

  t.opticalValid = isOpticalFresh();
  t.rawIR = rawIR;

  t.imuValid = imuDataValid;
  t.ax = ax; t.ay = ay; t.az = az;
  t.gx = gx; t.gy = gy; t.gz = gz;

  t.motorOn = motorOn;

  // Queue length is 1: if the previous packet has not been sent
  // yet, it is replaced by the newest one instead of piling up.
  xQueueOverwrite(telemetryQueue, &t);
}

void startNetwork() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("WiFi connecting to ");
  Serial.println(WIFI_SSID);

  telemetryQueue = xQueueCreate(1, sizeof(Telemetry));

  if (!telemetryQueue) {
    Serial.println("Telemetry queue creation FAILED.");
    return;
  }

  xTaskCreate(senderTask, "telemetry", 8192, nullptr, 1, nullptr);
}

// ==================== Serial output ====================

void printMeasurements() {
  Serial.print("DEMO_BPM:");
  Serial.print(demoBPM, 1);
  Serial.print(" Source:SIMULATED");

  Serial.print(" | TempC:");

  if (temperatureValid) {
    Serial.print(temperatureC, 2);
  } else {
    Serial.print("--");
  }

  Serial.print(" | RAW_IR:");

  if (isOpticalFresh()) {
    Serial.print(rawIR);
  } else {
    Serial.print("--");
  }

  Serial.print(" | IMU:");

  if (imuDataValid) {
    Serial.print("OK");

    Serial.print(" AX:");
    Serial.print(ax, 2);

    Serial.print(" AY:");
    Serial.print(ay, 2);

    Serial.print(" AZ:");
    Serial.print(az, 2);

    Serial.print(" GX:");
    Serial.print(gx, 1);

    Serial.print(" GY:");
    Serial.print(gy, 1);

    Serial.print(" GZ:");
    Serial.print(gz, 1);
  } else {
    Serial.print("ERROR");
  }

  Serial.print(" | Motor:");
  Serial.print(motorOn ? "ON" : "OFF");

  Serial.print(" | WiFi:");
  Serial.print(WiFi.status() == WL_CONNECTED ? "OK" : "--");

  Serial.print(" | HTTP:");
  Serial.print(lastHttpCode);
  Serial.print(" ok:");
  Serial.print(sentOk);
  Serial.print(" fail:");
  Serial.println(sentFailed);
}

// ==================== Setup ====================

void setup() {
  digitalWrite(MOTOR_PIN, LOW);
  pinMode(MOTOR_PIN, OUTPUT);

  Serial.begin(115200);
  delay(1500);

  Serial.println();
  Serial.println("Combined prototype hardware test");
  Serial.println("REAL: IMU, temperature, raw optical data");
  Serial.println("SIMULATED: DEMO_BPM");
  Serial.println("Commands: v = vibrate, s = stop");

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(100000);
  Wire.setTimeOut(100);

  // Initialize IMU.
  imuReady = initializeIMU();

  Serial.println(
    imuReady ? "IMU ready." : "IMU initialization FAILED."
  );

  // Initialize temperature sensor.
  thermometer.begin();

  temperatureReady =
      thermometer.getAddress(temperatureAddress, 0);

  if (temperatureReady) {
    thermometer.setResolution(temperatureAddress, 12);
    thermometer.setWaitForConversion(false);

    Serial.println("Temperature sensor ready.");
  } else {
    Serial.println("Temperature sensor NOT FOUND.");
  }

  // Initialize optical sensor.
  opticalReady =
      opticalSensor.begin(Wire, I2C_SPEED_STANDARD);

  if (opticalReady) {
    // LED current, averaging, mode, sample rate,
    // pulse width, ADC range.
    opticalSensor.setup(0x1F, 4, 2, 400, 411, 4096);

    Serial.println("MAX30102 ready.");
  } else {
    Serial.println("MAX30102 NOT FOUND.");
  }

  // WiFi connects in the background; loop() does not wait for it.
  startNetwork();

  startTemperatureConversion();

  Serial.println("Ready. Open Serial Monitor at 115200 baud.");

  if (opticalReady) {
    opticalSensor.clearFIFO();
  }

  lastIMUMs = millis();
  lastPrintMs = millis();
  lastDemoUpdateMs = millis();
  lastSendMs = millis();
}

// ==================== Main loop ====================

void loop() {
  updateMotorAndCommands();

  updateIMU();
  updateOptical();
  updateTemperature();

  updateDemoBPM();

  uint32_t now = millis();

  if ((uint32_t)(now - lastSendMs) >= SEND_INTERVAL_MS) {
    lastSendMs = now;
    queueTelemetry();
  }

  if ((uint32_t)(now - lastPrintMs) >= 500) {
    lastPrintMs = now;

    if (Serial) {
      printMeasurements();
    }
  }
}
