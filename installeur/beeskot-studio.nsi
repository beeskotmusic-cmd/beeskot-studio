; =====================================================================
; Installeur de TEST de BEESKOT Studio (fabriqué hors GitHub).
; Installe pour l'utilisateur courant, sans droits administrateur.
; Le vrai installeur (avec mises à jour automatiques) sera fabriqué par GitHub.
; =====================================================================
Unicode true
!include "MUI2.nsh"

!define NOM      "BEESKOT Studio"
!define VERSION  "0.1.0"
!define EDITEUR  "DARI"
!define EXE      "beeskot-studio.exe"
!define CLE_DESINST "Software\Microsoft\Windows\CurrentVersion\Uninstall\${NOM}"

Name "${NOM}"
OutFile "BEESKOT-Studio_${VERSION}_installeur-test.exe"
InstallDir "$LOCALAPPDATA\${NOM}"
RequestExecutionLevel user
SetCompressor /SOLID lzma
BrandingText "DARI · ${NOM}"

!define MUI_ICON "..\src-tauri\icons\icon.ico"
!define MUI_UNICON "..\src-tauri\icons\icon.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Lancer ${NOM}"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "French"

Section "Installer"
  ; fermer une ancienne version ouverte
  nsExec::Exec 'taskkill /IM ${EXE} /F'
  SetOutPath "$INSTDIR"
  File "..\src-tauri\target\x86_64-pc-windows-msvc\release\${EXE}"
  WriteUninstaller "$INSTDIR\desinstaller.exe"
  CreateShortcut "$DESKTOP\${NOM}.lnk" "$INSTDIR\${EXE}"
  CreateDirectory "$SMPROGRAMS\${NOM}"
  CreateShortcut "$SMPROGRAMS\${NOM}\${NOM}.lnk" "$INSTDIR\${EXE}"
  CreateShortcut "$SMPROGRAMS\${NOM}\Désinstaller ${NOM}.lnk" "$INSTDIR\desinstaller.exe"
  WriteRegStr HKCU "${CLE_DESINST}" "DisplayName" "${NOM}"
  WriteRegStr HKCU "${CLE_DESINST}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${CLE_DESINST}" "Publisher" "${EDITEUR}"
  WriteRegStr HKCU "${CLE_DESINST}" "DisplayIcon" "$INSTDIR\${EXE}"
  WriteRegStr HKCU "${CLE_DESINST}" "UninstallString" '"$INSTDIR\desinstaller.exe"'
  WriteRegDWORD HKCU "${CLE_DESINST}" "NoModify" 1
  WriteRegDWORD HKCU "${CLE_DESINST}" "NoRepair" 1
  ; le moteur d'affichage de Windows (WebView2) est déjà là sur Windows 10 et 11
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  ReadRegStr $1 HKCU "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  StrCmp "$0$1" "" 0 +2
    MessageBox MB_ICONINFORMATION "Il manque un petit composant de Windows (WebView2). Une page va s'ouvrir pour l'installer gratuitement." /SD IDOK
  StrCmp "$0$1" "" 0 +2
    ExecShell "open" "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /IM ${EXE} /F'
  Delete "$INSTDIR\${EXE}"
  Delete "$INSTDIR\desinstaller.exe"
  RMDir "$INSTDIR"
  Delete "$DESKTOP\${NOM}.lnk"
  RMDir /r "$SMPROGRAMS\${NOM}"
  DeleteRegKey HKCU "${CLE_DESINST}"
  ; les réglages et les fiches du groupe (dans le Drive) ne sont jamais effacés
SectionEnd
