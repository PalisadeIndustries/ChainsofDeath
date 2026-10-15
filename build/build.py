#!/usr/bin/env python3
"""Build public/game.js and public/index.html from the sources.
Usage: python3 build/build.py <game_src.js> <ui.js> <shell.html> <mask.txt>"""
import sys, pathlib, subprocess
here = pathlib.Path(__file__).resolve().parent
root = here.parent
game_src, ui, shell, mask = [pathlib.Path(a) for a in sys.argv[1:5]]
pub = root / 'public'; pub.mkdir(exist_ok=True)

g = game_src.read_text()
assert g.count('__MASK__') == 1
(pub / 'game.js').write_text(g.replace('__MASK__', mask.read_text().strip()))

subprocess.run([sys.executable, str(here / 'client.py'), str(ui), str(here / 'ui_mp.js')], check=True)
ui_mp = (here / 'ui_mp.js').read_text() + '\n' + (here / 'net.js').read_text()

h = shell.read_text()
extra_css = r"""
[hidden]{display:none!important}
html,body{margin:0;height:100%;background:#070c0f}
#h-net{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
#h-net:empty{display:none}
#h-net .pl{display:inline-flex;align-items:center;gap:5px;font:500 12px var(--f-ui);padding:2px 8px;border-radius:999px;border:1px solid var(--line);color:var(--fg);background:rgba(11,20,24,.6)}
#h-net .pl i{width:8px;height:8px;border-radius:50%;display:inline-block}
#h-net .pl.rd{border-color:rgba(143,195,122,.7)}
#h-net .pl.off{opacity:.55}
#h-net .pl.dead{text-decoration:line-through;opacity:.45}
#h-net .dl{font-size:12px;color:var(--mute)}
#endturn.on{background:#3a4a52;color:var(--fg)}
#lobby{position:absolute;inset:0;z-index:30;background:radial-gradient(ellipse at 50% 30%,#16262d,#070c0f 75%);display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto}
#lobby[hidden]{display:none}
#lobby .card{width:100%;max-width:440px}
#lobby input,#lobby select{width:100%}
#lobby .row input{flex:1}
#lobby .chk{display:flex;gap:8px;align-items:center;font-size:14px}
#lobby .chk input{width:auto}
#lobby .dot{width:9px;height:9px;border-radius:50%;background:#45545a;flex:none}
#lobby .dot.on{background:#8fc37a}
#lobby .urow{display:flex;gap:8px;align-items:center}
#chat{position:absolute;z-index:15;right:12px;top:150px;width:min(340px,calc(100vw - 32px));max-height:min(420px,60vh);background:var(--panel2);border:1px solid var(--line);border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.5);display:flex;flex-direction:column}
#chat[hidden]{display:none}
#chat header{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-bottom:1px solid var(--line)}
#chat-log{overflow-y:auto;padding:8px 10px;flex:1;font-size:14px;line-height:1.4}
#chat-log p{margin:0 0 6px}
#chat form{display:flex;gap:6px;padding:8px;border-top:1px solid var(--line)}
#chat-in{flex:1;min-width:0}
#net-down{position:absolute;z-index:40;top:8px;left:50%;transform:translateX(-50%);background:#5a2a24;color:#fff;font:600 13px var(--f-ui);padding:6px 12px;border-radius:6px}
#net-down[hidden]{display:none}
</style>"""
def rep(old, new):
    global h
    assert h.count(old) == 1, old
    h = h.replace(old, new)
rep('</style>', extra_css)
rep('<div class="hrow" id="h-todo"></div>', '<div class="hrow" id="h-todo"></div>\n    <div class="hrow" id="h-net"></div>')
rep('<button id="endturn">End quarter</button>', '<button id="endturn" title="Enter">Ready</button>')
rep('<div id="over" hidden></div>', '''<div id="over" hidden></div>
  <section id="chat" hidden aria-label="Dispatches"><header><b>Dispatches</b><button class="ghost sm" id="chat-x">Close</button></header><div id="chat-log"></div><form id="chat-f"><input id="chat-in" maxlength="300" placeholder="Message every player" autocomplete="off"><button class="pri sm">Send</button></form></section>
  <div id="lobby"><div class="card"><p class="note">Connecting to the server…</p></div></div>
  <div id="net-down" hidden>Connection lost. Reconnecting…</div>''')
rep('<script>\n__LOGIC__\n</script>', '<script src="/game.js"></script>')
rep('__UI__', ui_mp)
h = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + h + '\n</html>\n'
(pub / 'index.html').write_text(h)
print('built', pub)
