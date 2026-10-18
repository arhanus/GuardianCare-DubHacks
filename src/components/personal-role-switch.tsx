import { Text, View } from "react-native";
import { Action, s } from "../ui";
import { useSession } from "../session";
export function PersonalRoleSwitch() {
 const { personalRole, setPersonalRole } = useSession();
 return <View style={{ flexDirection: "row", gap: 8, alignItems: "stretch" }}>{([["owner", "My bracelet"], ["trusted", "Helping a loved one"]] as const).map(([role, label]) => <Action key={role} accessibilityState={{ selected: personalRole === role }} onPress={() => setPersonalRole(role)} style={[s.choice, { minWidth: 0 }, personalRole === role && s.choiceSelected]}><Text style={s.title}>{label}</Text></Action>)}</View>;
}
