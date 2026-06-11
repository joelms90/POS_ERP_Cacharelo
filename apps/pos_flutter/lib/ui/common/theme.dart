import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'colors.dart';

class EmpireTheme {
  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: EmpireColors.obsidian,
      colorScheme: const ColorScheme.dark(
        primary: EmpireColors.champagneGold,
        secondary: EmpireColors.agedBronze,
        surface: EmpireColors.onyxSurface,
        background: EmpireColors.obsidian,
        error: EmpireColors.errorRed,
        onPrimary: EmpireColors.obsidian,
        onSecondary: EmpireColors.textPrimary,
        onSurface: EmpireColors.textPrimary,
        onBackground: EmpireColors.textPrimary,
      ),
      cardTheme: CardThemeData(
        color: EmpireColors.onyxSurface,
        shape: RoundedRectangleBorder(
          side: const BorderSide(color: EmpireColors.agedBronzeDark, width: 1),
          borderRadius: BorderRadius.circular(12),
        ),
        elevation: 4,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: EmpireColors.obsidian,
        elevation: 0,
        centerTitle: true,
        iconTheme: const IconThemeData(color: EmpireColors.champagneGold),
        titleTextStyle: GoogleFonts.bodoniModa(
          color: EmpireColors.champagneGold,
          fontSize: 22,
          fontWeight: FontWeight.bold,
          letterSpacing: 1.5,
        ),
      ),
      textTheme: TextTheme(
        // Bodoni Moda for display headers
        displayLarge: GoogleFonts.bodoniModa(
          fontSize: 32,
          fontWeight: FontWeight.bold,
          color: EmpireColors.champagneGold,
        ),
        displayMedium: GoogleFonts.bodoniModa(
          fontSize: 26,
          fontWeight: FontWeight.w600,
          color: EmpireColors.champagneGold,
        ),
        titleLarge: GoogleFonts.bodoniModa(
          fontSize: 20,
          fontWeight: FontWeight.bold,
          color: EmpireColors.textPrimary,
        ),
        // Inter for body, labels, buttons
        bodyLarge: GoogleFonts.inter(
          fontSize: 16,
          color: EmpireColors.textPrimary,
        ),
        bodyMedium: GoogleFonts.inter(
          fontSize: 14,
          color: EmpireColors.textSecondary,
        ),
        labelLarge: GoogleFonts.inter(
          fontSize: 14,
          fontWeight: FontWeight.bold,
          color: EmpireColors.obsidian,
        ),
        labelMedium: GoogleFonts.inter(
          fontSize: 12,
          fontWeight: FontWeight.w500,
          color: EmpireColors.textSecondary,
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: EmpireColors.champagneGold,
          foregroundColor: EmpireColors.obsidian,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: GoogleFonts.inter(
            fontWeight: FontWeight.bold,
            fontSize: 15,
            letterSpacing: 0.5,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: EmpireColors.champagneGold,
          side: const BorderSide(color: EmpireColors.agedBronze, width: 1.5),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: GoogleFonts.inter(
            fontWeight: FontWeight.bold,
            fontSize: 15,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: EmpireColors.onyxSurface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(
            color: EmpireColors.agedBronzeDark,
            width: 1,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(
            color: EmpireColors.agedBronzeDark,
            width: 1,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(
            color: EmpireColors.champagneGold,
            width: 1.5,
          ),
        ),
        hintStyle: GoogleFonts.inter(color: EmpireColors.textSecondary),
        labelStyle: GoogleFonts.inter(color: EmpireColors.textPrimary),
      ),
    );
  }
}
