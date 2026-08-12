import { memo, useCallback, useEffect, useRef } from "react";
import {
  Pressable,
  Platform,
  ScrollView,
  TextInput,
  View,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type ViewProps,
  useColorScheme,
} from "react-native";

import { AppText as Text } from "../../components/AppText";
import { MOBILE_TYPOGRAPHY } from "../../lib/typography";
import { terminalKeyInputData } from "../../lib/terminalKeys";
import type { TerminalKey, TerminalSubmitKey } from "../../lib/types";
import {
  getNativeTerminalHardwareKeyRevision,
  resolveNativeTerminalSurfaceView,
} from "./nativeTerminalModule";
import {
  buildGhosttyThemeConfig,
  getPierreTerminalTheme,
  type TerminalTheme,
} from "./terminalTheme";
import { terminalDebugLog } from "./terminalDebugLog";

interface TerminalInputEvent {
  readonly data?: string;
  readonly key?: TerminalSubmitKey;
}

interface TerminalResizeEvent {
  readonly cols: number;
  readonly rows: number;
}

interface TerminalViewportScrollEvent {
  readonly rows: number;
}

interface TerminalSurfaceProps extends ViewProps {
  readonly terminalKey: string;
  readonly buffer: string;
  readonly fontSize?: number;
  readonly isRunning: boolean;
  readonly autoFocus?: boolean;
  readonly keyboardFocusRequest?: number;
  readonly androidImeSubmitKey?: TerminalSubmitKey;
  readonly theme?: TerminalTheme;
  readonly onInput: (data: string) => void;
  readonly onKey?: (key: TerminalKey) => void;
  readonly onSubmit?: (data: string, key: TerminalSubmitKey) => void;
  readonly onResize: (size: { readonly cols: number; readonly rows: number }) => void;
  readonly onViewportScroll?: (rows: number) => void;
}

function estimateGridSize(input: {
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
}): { readonly cols: number; readonly rows: number } {
  const cellWidth = input.fontSize * 0.62;
  const cellHeight = input.fontSize * 1.35;
  return {
    cols: Math.max(20, Math.min(400, Math.floor(input.width / cellWidth))),
    rows: Math.max(5, Math.min(200, Math.floor(input.height / cellHeight))),
  };
}

const FallbackTerminalSurface = memo(function FallbackTerminalSurface(props: TerminalSurfaceProps) {
  const fontSize = props.fontSize ?? MOBILE_TYPOGRAPHY.label.fontSize;
  const inputRef = useRef<TextInput>(null);
  const appearanceScheme = useColorScheme() === "light" ? "light" : "dark";
  const theme = props.theme ?? getPierreTerminalTheme(appearanceScheme);
  const statusLabel = props.isRunning
    ? "Native terminal unavailable. Using text fallback."
    : "Open terminal to start a shell.";
  const submitKey = Platform.OS === "android" ? (props.androidImeSubmitKey ?? "Enter") : "Enter";

  const handleSubmit = (data: string, key: TerminalSubmitKey) => {
    if (props.onSubmit) {
      props.onSubmit(data, key);
    } else if (props.onKey) {
      if (data.length > 0) props.onInput(data);
      props.onKey(key);
    } else {
      props.onInput(data + terminalKeyInputData(key));
    }
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    props.onResize(estimateGridSize({ width, height, fontSize }));
  };

  useEffect(() => {
    if ((props.keyboardFocusRequest ?? 0) > 0) {
      inputRef.current?.blur();
      const focusFrame = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(focusFrame);
    }

    return undefined;
  }, [props.keyboardFocusRequest]);

  return (
    <View
      className="flex-1"
      style={[
        {
          backgroundColor: theme.background,
          borderRadius: 8,
          overflow: "hidden",
        },
        props.style,
      ]}
      onLayout={handleLayout}
    >
      <View className="flex-1 px-2.5 py-2">
        <Text
          className="pb-2 text-2xs"
          style={{
            color: theme.mutedForeground,
          }}
        >
          {statusLabel}
        </Text>
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-3"
          showsVerticalScrollIndicator={false}
        >
          <Text
            selectable
            style={{
              color: theme.foreground,
              fontFamily: "Menlo",
              fontSize,
              lineHeight: Math.round(fontSize * 1.35),
            }}
          >
            {props.buffer || "$ "}
          </Text>
        </ScrollView>
      </View>
      <View
        className="flex-row items-center gap-2 border-t p-2"
        style={{
          borderTopColor: theme.border,
        }}
      >
        <TextInput
          ref={inputRef}
          autoCapitalize="none"
          autoCorrect={false}
          blurOnSubmit={false}
          editable={props.isRunning}
          placeholder="type and press return"
          placeholderTextColor={theme.mutedForeground}
          returnKeyType="send"
          className="text-sm"
          style={{
            color: theme.foreground,
            flex: 1,
            fontFamily: "Menlo",
            padding: 0,
          }}
          onSubmitEditing={(event) => {
            handleSubmit(event.nativeEvent.text, submitKey);
          }}
        />
        <Pressable
          disabled={!props.isRunning}
          style={({ pressed }) => ({
            opacity: !props.isRunning ? 0.35 : pressed ? 0.65 : 1,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            backgroundColor: theme.border,
          })}
          onPress={() => props.onInput("\u0003")}
        >
          <Text className="text-2xs font-t3-bold" style={{ color: theme.foreground }}>
            Ctrl-C
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

export const TerminalSurface = memo(function TerminalSurface(props: TerminalSurfaceProps) {
  const fontSize = props.fontSize ?? MOBILE_TYPOGRAPHY.label.fontSize;
  const appearanceScheme = useColorScheme() === "light" ? "light" : "dark";
  const theme = props.theme ?? getPierreTerminalTheme(appearanceScheme);
  const { onInput, onResize } = props;
  const NativeTerminalSurfaceView = resolveNativeTerminalSurfaceView();
  const hasNativeSurface = Boolean(NativeTerminalSurfaceView);

  useEffect(() => {
    terminalDebugLog("native:surface", {
      terminalKey: props.terminalKey,
      native: hasNativeSurface,
      // null = installed binary predates native hardware-key handling (rebuild needed).
      hardwareKeyRevision: getNativeTerminalHardwareKeyRevision(),
      bufferLen: props.buffer.length,
      isRunning: props.isRunning,
    });
  }, [hasNativeSurface, props.buffer.length, props.isRunning, props.terminalKey]);
  const handleNativeInput = useCallback(
    (event: NativeSyntheticEvent<TerminalInputEvent>) => {
      if (!props.isRunning) {
        return;
      }
      terminalDebugLog("native:onInput", {
        codes: event.nativeEvent.data
          ? Array.from(event.nativeEvent.data, (char) => char.codePointAt(0))
          : [],
        key: event.nativeEvent.key,
      });
      const { data, key } = event.nativeEvent;
      if (key && data !== undefined && props.onSubmit) {
        props.onSubmit(data, key);
      } else if (key && data !== undefined && !props.onKey) {
        onInput(data + terminalKeyInputData(key));
      } else if (key && props.onKey) {
        if (data) onInput(data);
        props.onKey(key);
      } else if (key) {
        onInput(terminalKeyInputData(key));
      } else if (event.nativeEvent.data !== undefined) {
        onInput(event.nativeEvent.data);
      }
    },
    [onInput, props.isRunning, props.onKey, props.onSubmit],
  );
  const handleNativeResize = useCallback(
    (event: NativeSyntheticEvent<TerminalResizeEvent>) => {
      onResize({
        cols: event.nativeEvent.cols,
        rows: event.nativeEvent.rows,
      });
    },
    [onResize],
  );
  const handleViewportScroll = useCallback(
    (event: NativeSyntheticEvent<TerminalViewportScrollEvent>) => {
      props.onViewportScroll?.(event.nativeEvent.rows);
    },
    [props.onViewportScroll],
  );

  if (NativeTerminalSurfaceView) {
    return (
      <View style={props.style}>
        <NativeTerminalSurfaceView
          appearanceScheme={appearanceScheme}
          autoFocus={props.autoFocus ?? true}
          externalScroll={Boolean(props.onViewportScroll)}
          backgroundColor={theme.background}
          focusRequest={props.isRunning ? (props.keyboardFocusRequest ?? 0) : 0}
          foregroundColor={theme.foreground}
          {...(Platform.OS === "android"
            ? { imeSubmitKey: props.androidImeSubmitKey ?? "Enter" }
            : {})}
          mutedForegroundColor={theme.mutedForeground}
          terminalKey={props.terminalKey}
          initialBuffer={props.buffer}
          fontSize={fontSize}
          style={{ flex: 1 }}
          themeConfig={buildGhosttyThemeConfig(theme)}
          onInput={handleNativeInput}
          onResize={handleNativeResize}
          onViewportScroll={handleViewportScroll}
        />
      </View>
    );
  }

  return <FallbackTerminalSurface {...props} fontSize={fontSize} theme={theme} />;
});
