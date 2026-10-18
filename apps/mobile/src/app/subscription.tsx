import { useState } from "react";
import { Animated, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowRight, Check, UsersRound, UserRound } from "lucide-react-native";
import { useSession } from "../session";
import { Action as Pressable, colors } from "../ui";
import { RollingPrice } from "../components/rolling-price";
import { useScreenMotion } from "../motion";

const basePlans = [
  { id: "plus", title: "Plus", monthly: 10, yearly: 100, caption: "For you and the people closest to you.", Icon: UserRound,
    features: ["A personal care space", "Wearable connection overview", "Sensor history and trends", "Assistance event overview"] },
  { id: "pro", title: "Pro", monthly: 100, yearly: 1000, caption: "Advanced care for individuals and hospital teams.", Icon: UsersRound,
    features: ["A shared care dashboard", "People and device overview", "Assistance event coordination", "Organization care profiles"] },
] as const;

export default function Subscription() {
  const { session, subscriptionPreference, saveSubscriptionPreference } = useSession();
  const { width, height, fontScale } = useWindowDimensions();
  const inlineCheckout = height < 600 || fontScale > 1.3;
  const entrance = useScreenMotion();
  const organization = session?.type === "organization";
  const plans = basePlans.map(plan => plan.id === "pro" && !organization
    ? { ...plan, monthly: 30, yearly: 300 }
    : plan);
  const [selected, setSelected] = useState<"plus" | "pro">(organization ? "pro" : subscriptionPreference.plan);
  const [reviewing, setReviewing] = useState(false);
  const [yearly, setYearly] = useState(subscriptionPreference.yearly);
  const [saved, setSaved] = useState(false);
  const plan = plans.find(item => item.id === selected)!;
  const amount = yearly ? plan.yearly : plan.monthly;
  const period = yearly ? "year" : "month";

  const checkout = (
<View style={styles.checkout}>
        <Text style={styles.muted}>No active subscription · Saved preference: {subscriptionPreference.plan === "pro" ? "Pro" : "Plus"}, {subscriptionPreference.yearly ? "yearly" : "monthly"}</Text>
        <Text style={styles.hardwareTitle}>Selected: {plan.title} · ${amount.toLocaleString("en-US")}/{period}</Text>
        {reviewing && <Text accessibilityLiveRegion="polite" style={styles.caption}>Demo preference only. No charge or activation. {yearly ? "Annual" : "Monthly"} price: ${amount.toLocaleString("en-US")}.</Text>}
        <Pressable onPress={() => { if (!reviewing) { setReviewing(true); return; } saveSubscriptionPreference({ plan: selected, yearly }); setSaved(true); }} style={({ pressed }) => [styles.button, styles.darkButton, pressed && styles.pressed]}><Text style={[styles.buttonText, styles.whiteText]}>{reviewing ? "Save plan preference" : "Review selected plan"}</Text><Check size={18} color="white" /></Pressable>
        {saved && <Text accessibilityLiveRegion="polite" style={styles.savings}>Saved for this session. No payment collected.</Text>}
        {reviewing && <Pressable onPress={() => { setReviewing(false); setSaved(false); }} style={styles.billingOption}><Text style={styles.monthlyText}>Back to comparison</Text></Pressable>}
      </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      <Animated.View style={[{ flex: 1 }, entrance]}><ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>GUARDIANCARE SUBSCRIPTIONS</Text>
          <Text accessibilityRole="header" style={styles.title}>Your subscription.</Text>
          <Text style={styles.subtitle}>{organization ? "Pro for your hospital and care team." : "Two plans for you. Plus for everyday essentials. Pro for a deeper view of your day."}</Text>
          <View style={styles.billing}>
            {[false, true].map(annual => <Pressable key={String(annual)} accessibilityRole="button"
              accessibilityLabel={annual ? "Yearly billing" : "Monthly billing"} accessibilityState={{ selected: yearly === annual }}
              onPress={() => { setYearly(annual); setReviewing(false); setSaved(false); }}
              style={({ pressed }) => [styles.billingOption, yearly === annual && styles.billingSelected, pressed && styles.pressed]}>
              <Text style={[styles.monthlyText, yearly === annual && styles.whiteText]}>{annual ? "Yearly" : "Monthly"}</Text>
            </Pressable>)}
          </View>
          <Text style={styles.savings}>Save 16.7% with yearly billing</Text>
        </View>

        <View style={[styles.plans, width >= 720 && styles.planRow]}>
          {plans.filter(offer => !organization || offer.id === "pro").map(({ id, title, monthly, yearly: annualPrice, caption, Icon, features }) => {
            const active = selected === id;
            const unavailable = organization && id === "plus";
            const personalPro = !organization && id === "pro";
            const PlanIcon = personalPro ? UserRound : Icon;
            const description = personalPro ? "More detail. More perspective. Your personal wellbeing, in focus." : caption;
            const benefits = personalPro ? ["Everything in Plus", "Detailed personal sensor trends", "24h and 7d comparisons", "Your activity and event timeline"] : features;
            return (
              <View key={id} style={[styles.card, active && styles.activeCard]}>
                <View style={styles.cardTop}>
                  <View style={styles.planIcon}><PlanIcon size={24} color={colors.ink} /></View>
                  {active && <View style={styles.selected}><Check size={13} color={colors.green} /><Text style={styles.selectedText}>Selected</Text></View>}
                </View>
                <Text accessibilityRole="header" style={styles.planTitle}>{title}</Text>
                <Text style={[styles.caption, styles.planDescription]}>{description}</Text>
                <View style={styles.priceBlock}>
                  <RollingPrice amount={yearly ? annualPrice : monthly} yearly={yearly} />
                  <Text style={styles.muted}>{organization ? "Per organization · " : "Personal use · "}billed {yearly ? "yearly" : "monthly"}</Text>
                  <Text style={styles.savings}>{yearly ? `Save $${(monthly * 12 - annualPrice).toLocaleString("en-US")} a year` : " "}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Select ${title} ${period} plan`}
                  disabled={unavailable} accessibilityState={{ selected: active, disabled: unavailable }} onPress={() => { setSelected(id); setReviewing(false); setSaved(false); }}
                  style={({ pressed }) => [styles.button, active ? styles.darkButton : styles.lightButton, unavailable && { opacity: 0.45 }, pressed && styles.pressed]}>
                  <Text style={[styles.buttonText, active && styles.whiteText]}>{unavailable ? "Personal accounts only" : active ? `${title} selected` : `Choose ${title}`}</Text>
                  {active ? <Check size={18} color="white" /> : <ArrowRight size={18} color={colors.ink} />}
                </Pressable>
                <View style={styles.divider} />
                <Text style={styles.includes}>PLANNED FOR THIS PLAN</Text>
                {benefits.map(feature => <View key={feature} style={styles.feature}><Check size={17} color={colors.green} /><Text style={styles.featureText}>{feature}</Text></View>)}
              </View>
            );
          })}
        </View>

        {!organization && <View style={styles.review}>
          <Text style={styles.hardwareTitle}>Compare personal plans</Text>
          <Text style={styles.caption}>Plus · Personal dashboard, wearable overview and sample history.</Text>
          <Text style={styles.caption}>Pro · Everything in Plus, detailed trends, 24h / 7d comparisons and your event timeline.</Text>
          <Text style={styles.muted}>Pro features are planned. This demo does not enforce paid access.</Text>
        </View>}
        <Text style={styles.footer}>Membership preview · Current app data and care events are simulated.</Text>
      {inlineCheckout && checkout}</ScrollView></Animated.View>
      {!inlineCheckout && checkout}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  checkout: { width: "100%", maxWidth: 980, alignSelf: "center", padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: "100%", maxWidth: 980, alignSelf: "center", padding: 20, paddingBottom: 40, gap: 22 },
  hero: { alignItems: "center", paddingVertical: 22, gap: 16 },
  eyebrow: { color: colors.green, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title: { fontSize: 42, lineHeight: 47, color: colors.ink, fontWeight: "800", letterSpacing: -1.8, textAlign: "center" },
  subtitle: { color: "#626262", fontSize: 16, lineHeight: 25, textAlign: "center", maxWidth: 360 },
  billing: { flexDirection: "row", padding: 5, borderRadius: 30, backgroundColor: "#EEEEEE", gap: 4 },
  billingOption: { minHeight: 48, paddingHorizontal: 26, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  billingSelected: { backgroundColor: colors.ink },
  savings: { color: colors.green, fontSize: 13, fontWeight: "600" },
  monthlyText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  hardwareTitle: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  muted: { color: "#626262", fontSize: 13, lineHeight: 19 },
  plans: { gap: 16 },
  planRow: { flexDirection: "row", alignItems: "stretch" },
  card: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.line, borderRadius: 24, padding: 24, backgroundColor: "#FFFFFF", gap: 14 },
  activeCard: { borderColor: colors.ink },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  planIcon: { padding: 12, backgroundColor: "#F4F4F4", borderRadius: 15 },
  selected: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#EAF4EF", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  selectedText: { fontSize: 12, fontWeight: "700", color: colors.green },
  planTitle: { color: colors.ink, fontSize: 25, fontWeight: "700", letterSpacing: -0.7 },
  caption: { color: "#626262", fontSize: 15, lineHeight: 23 },
  planDescription: { minHeight: 46 },
  priceBlock: { gap: 5, paddingVertical: 12 },
  button: { minHeight: 52, paddingHorizontal: 17, paddingVertical: 14, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  darkButton: { backgroundColor: colors.ink },
  lightButton: { backgroundColor: "#F0F0F0" },
  buttonText: { color: colors.ink, fontSize: 15, fontWeight: "700", flexShrink: 1 },
  whiteText: { color: "#FFFFFF" },
  pressed: { opacity: 0.72 },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 8 },
  includes: { color: "#626262", fontSize: 11, fontWeight: "700", letterSpacing: 1.1 },
  feature: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  featureText: { flex: 1, color: "#444444", fontSize: 14, lineHeight: 21 },
  summary: { gap: 14, paddingVertical: 10 },
  review: { padding: 20, borderRadius: 18, backgroundColor: "#EEEEEA", gap: 12 },
  footer: { textAlign: "center", color: "#626262", fontSize: 12, lineHeight: 19 },
});
