"""Autoclicker für Windows, macOS und Linux – klickt in jedem Programm und Spiel.

Einmalig installieren:   pip install pynput
Starten:                 python autoclicker.py            (Standard: 10 Klicks/s, Linksklick)
                         python autoclicker.py --cps 15 --button right

Tasten (funktionieren auch, während ein Spiel im Vordergrund ist):
  F6  = Klicken an/aus
  F7  = Links-/Rechtsklick umschalten
  F8  = langsamer   F9 = schneller
  F10 = beenden

macOS: Terminal bzw. Python unter Systemeinstellungen → Datenschutz & Sicherheit →
„Bedienungshilfen“ und „Eingabeüberwachung“ erlauben, sonst kommen keine Klicks an.
"""

import argparse
import threading
import time

from pynput import keyboard, mouse


class AutoClicker:
    def __init__(self, cps, button):
        self.cps = cps
        self.button = button
        self.running = threading.Event()
        self.quit = threading.Event()
        self.mouse = mouse.Controller()

    def loop(self):
        next_at = time.perf_counter()
        while not self.quit.is_set():
            if not self.running.wait(0.05):
                continue
            now = time.perf_counter()
            if now < next_at:
                time.sleep(min(next_at - now, 0.05))
                continue
            self.mouse.click(self.button)
            # Feste Taktung statt sleep(1/cps), damit die Rate auch bei langsamen Klicks stimmt.
            next_at = max(next_at + 1 / self.cps, now)

    def toggle(self):
        if self.running.is_set():
            self.running.clear()
            print("AUS")
        else:
            self.running.set()
            print(f"AN – {self.cps} Klicks/s, {self.button_name()}")

    def button_name(self):
        return "Linksklick" if self.button == mouse.Button.left else "Rechtsklick"

    def change_cps(self, delta):
        step = 5 if self.cps >= 20 else 2 if self.cps >= 10 else 1
        self.cps = max(1, min(50, self.cps + delta * step))
        print(f"{self.cps} Klicks/s")

    def on_press(self, key):
        if key == keyboard.Key.f6:
            self.toggle()
        elif key == keyboard.Key.f7:
            self.button = mouse.Button.right if self.button == mouse.Button.left else mouse.Button.left
            print(self.button_name())
        elif key == keyboard.Key.f8:
            self.change_cps(-1)
        elif key == keyboard.Key.f9:
            self.change_cps(+1)
        elif key == keyboard.Key.f10:
            self.running.clear()
            self.quit.set()
            print("Beendet.")
            return False


def main():
    parser = argparse.ArgumentParser(description="Autoclicker mit F6 zum Starten/Stoppen")
    parser.add_argument("--cps", type=int, default=10, help="Klicks pro Sekunde (1–50)")
    parser.add_argument("--button", choices=["left", "right"], default="left")
    args = parser.parse_args()

    clicker = AutoClicker(max(1, min(50, args.cps)), mouse.Button[args.button])
    threading.Thread(target=clicker.loop, daemon=True).start()
    print("Autoclicker bereit. F6 = an/aus, F7 = Taste wechseln, F8/F9 = Tempo, F10 = beenden")
    with keyboard.Listener(on_press=clicker.on_press) as listener:
        listener.join()


if __name__ == "__main__":
    main()
