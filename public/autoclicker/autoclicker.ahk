; Autoclicker für Windows – klickt in jedem Programm und Spiel (z. B. Minecraft).
; Benötigt AutoHotkey v2: https://www.autohotkey.com  →  Datei doppelklicken zum Starten.
;
;   F6  = Klicken an/aus (hoher Ton = an, tiefer Ton = aus)
;   F7  = Links-/Rechtsklick umschalten
;   F8  = langsamer   F9 = schneller
;   F10 = Autoclicker beenden

#Requires AutoHotkey v2.0
#SingleInstance Force

global Cps := 10           ; Klicks pro Sekunde (1–50)
global Button := "Left"    ; "Left" oder "Right"
global Running := false
global NextAt := 0

Notify("Autoclicker bereit – F6 startet/stoppt")

F6:: {
    global Running, NextAt
    Running := !Running
    if Running {
        NextAt := A_TickCount
        ; Windows-Timer laufen nur in ~15-ms-Schritten. Darum wird schnell geprüft und
        ; anhand der Uhr so oft geklickt, dass der Durchschnitt genau Cps ergibt.
        SetTimer DoClick, 10
        SoundBeep 1200, 80
        Notify("Autoclicker AN – " Cps " Klicks/s, " ButtonName())
    } else {
        SetTimer DoClick, 0
        SoundBeep 600, 80
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
    global NextAt
    now := A_TickCount
    if (NextAt < now - 200)    ; nach einer Pause nicht alle verpassten Klicks nachholen
        NextAt := now
    while (NextAt <= now) {
        Click Button
        NextAt += 1000 / Cps
    }
}

ChangeCps(delta) {
    global Cps
    step := Cps >= 20 ? 5 : Cps >= 10 ? 2 : 1
    Cps := Max(1, Min(50, Cps + delta * step))
    Notify(Cps " Klicks/s")
}

ButtonName() => Button = "Left" ? "Linksklick" : "Rechtsklick"

HideTip() => ToolTip()

Notify(text) {
    ToolTip text
    SetTimer HideTip, -1500
}
