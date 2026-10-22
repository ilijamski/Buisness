; Autoclicker für Windows – klickt in jedem Programm und Spiel (z. B. Minecraft).
; Benötigt AutoHotkey v2: https://www.autohotkey.com  →  Datei doppelklicken zum Starten.
;
;   F6  = Klicken an/aus
;   F7  = Links-/Rechtsklick umschalten
;   F8  = langsamer   F9 = schneller
;   F10 = Autoclicker beenden

#Requires AutoHotkey v2.0
#SingleInstance Force
SendMode "Input"
SetMouseDelay -1

global Cps := 10           ; Klicks pro Sekunde (1–50)
global Button := "Left"    ; "Left" oder "Right"
global Running := false

Notify("Autoclicker bereit – F6 startet/stoppt")

F6:: {
    global Running
    Running := !Running
    if Running {
        SetTimer DoClick, 1000 // Cps
        Notify("Autoclicker AN – " Cps " Klicks/s, " ButtonName())
    } else {
        SetTimer DoClick, 0
        Notify("Autoclicker AUS")
    }
}

F7:: {
    global Button
    Button := Button = "Left" ? "Right" : "Left"
    Notify(ButtonName())
}

F8::ChangeCps(-1)
F9::ChangeCps(+1)
F10::ExitApp

DoClick() {
    Click Button
}

ChangeCps(delta) {
    global Cps
    step := Cps >= 20 ? 5 : Cps >= 10 ? 2 : 1
    Cps := Max(1, Min(50, Cps + delta * step))
    if Running
        SetTimer DoClick, 1000 // Cps
    Notify(Cps " Klicks/s")
}

ButtonName() => Button = "Left" ? "Linksklick" : "Rechtsklick"

Notify(text) {
    ToolTip text
    SetTimer () => ToolTip(), -1500
}
