import { View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";

import {
  ComposerToolbarButton,
  ComposerToolbarRow,
  ComposerToolbarScroller,
} from "../../components/ComposerToolbarTrigger";
import {
  getTerminalAccessoryActions,
  type TerminalAccessoryAction,
  type TerminalModifier,
} from "./terminalAccessory";

export const TERMINAL_ACCESSORY_HEIGHT = 52;

export function TerminalKeyboardAccessory(props: {
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly includeClear?: boolean;
  readonly sticky?: boolean;
  readonly pendingModifier: TerminalModifier | null;
  readonly onAction: (action: TerminalAccessoryAction) => void;
  readonly onDismiss: () => void;
}) {
  const actions = getTerminalAccessoryActions({ includeClear: props.includeClear ?? false });
  const content = (
    <View
      className="border-t"
      style={{
        backgroundColor: props.backgroundColor,
        borderTopColor: props.borderColor,
        minHeight: TERMINAL_ACCESSORY_HEIGHT,
      }}
    >
      <ComposerToolbarRow paddingBottom={4} paddingHorizontal={8} paddingTop={4}>
        <ComposerToolbarScroller
          contentPaddingRight={2}
          fadeOpaque={props.backgroundColor}
          fadeTransparent={`${props.backgroundColor}00`}
        >
          {actions.map((action) => {
            const active =
              action.kind === "modifier" && props.pendingModifier === action.modifier;

            return (
              <ComposerToolbarButton
                key={action.key}
                active={active}
                accessibilityLabel={
                  action.kind === "send" ? action.accessibilityLabel : undefined
                }
                label={action.label}
                maxWidth={120}
                minWidth={action.label.length > 1 ? 56 : 44}
                onPress={() => props.onAction(action)}
                showChevron={false}
                textTransform={
                  action.kind === "modifier" || action.kind === "clear" ? "uppercase" : "none"
                }
              />
            );
          })}
        </ComposerToolbarScroller>
        <ComposerToolbarButton
          accessibilityLabel="Dismiss keyboard"
          icon={{ ios: "keyboard.chevron.compact.down", android: "keyboard_hide" }}
          onPress={props.onDismiss}
          showChevron={false}
        />
      </ComposerToolbarRow>
    </View>
  );

  if (props.sticky === false) return content;

  return (
    <KeyboardStickyView
      style={{ position: "absolute", bottom: 0, left: 0, right: 0 }}
      offset={{ closed: 0, opened: 0 }}
    >
      {content}
    </KeyboardStickyView>
  );
}
