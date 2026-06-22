// lib/theme.dart
// Tribo brand theme — ports the web design tokens (green palette + light cards)
// so the mobile app matches the web instead of generic Material teal.
import 'package:flutter/material.dart';

const triboGreen = Color(0xFF00B86B); // --green-500
const triboGreenDark = Color(0xFF008F4F); // --green-600
const triboGreenDeep = Color(0xFF066B3F); // --green-700
const triboGreenSoft = Color(0xFFE8F7EF); // --green-50
const triboInk = Color(0xFF0F1F15); // --ink
const triboMuted = Color(0xFF6B7A6F); // --muted
const triboLine = Color(0xFFE5EAE6); // --line
const triboBg = Color(0xFFF4F8F5); // --bg
const triboWarnBg = Color(0xFFFFF3CD);
const triboWarnFg = Color(0xFF8A6D00);

ThemeData triboTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: triboGreen,
    brightness: Brightness.light,
  ).copyWith(
    primary: triboGreen,
    onPrimary: Colors.white,
    surface: Colors.white,
    onSurface: triboInk,
    outline: triboMuted,
    outlineVariant: triboLine,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: triboBg,
    splashFactory: InkRipple.splashFactory,

    appBarTheme: const AppBarTheme(
      backgroundColor: triboBg,
      surfaceTintColor: Colors.transparent,
      foregroundColor: triboInk,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: triboInk,
        fontSize: 22,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.3,
      ),
    ),

    cardTheme: const CardThemeData(
      color: Colors.white,
      surfaceTintColor: Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.all(Radius.circular(14)),
        side: BorderSide(color: triboLine),
      ),
    ),

    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.white,
      indicatorColor: triboGreenSoft,
      elevation: 2,
      height: 64,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 12,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w600
              : FontWeight.w500,
          color: states.contains(WidgetState.selected) ? triboGreenDark : triboMuted,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected) ? triboGreenDark : triboMuted,
        ),
      ),
    ),

    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: triboGreen,
        foregroundColor: Colors.white,
        textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      ),
    ),

    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: triboGreenDark,
        side: const BorderSide(color: triboLine),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 18),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
      ),
    ),

    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: triboGreenDark),
    ),

    chipTheme: ChipThemeData(
      backgroundColor: Colors.white,
      selectedColor: triboGreenSoft,
      side: const BorderSide(color: triboLine),
      labelStyle: const TextStyle(fontSize: 13, color: triboInk),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: triboLine),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: triboLine),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: triboGreen, width: 2),
      ),
    ),

    dividerTheme: const DividerThemeData(color: triboLine, thickness: 1, space: 1),
  );
}
