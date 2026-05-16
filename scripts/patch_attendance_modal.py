import re
from pathlib import Path

p = Path("screens/AttendanceScreen.tsx")
text = p.read_text(encoding="utf-8")
new_body = """                    <ol className="mt-4 list-decimal list-inside text-slate-300 text-sm space-y-1 max-h-[40vh] overflow-y-auto">
                        {lineupPreviewOrder.map((id) => (
                            <li key={id}>
                                {(lineupPreviewTeam === 'teamA' ? teamAPlayers : teamBPlayers)[id]?.originalName ?? '—'}
                            </li>
                        ))}
                    </ol>
                </ConfirmationModal>"""
pattern = r'                    <div className="mt-4 space-y-4 text-left text-sm max-h-\[50vh\] overflow-y-auto">.*?</motion>\n                </ConfirmationModal>'
text2, n = re.subn(pattern, new_body, text, count=1, flags=re.S)
if n == 0:
    pattern = r'                    <div className="mt-4 space-y-4 text-left text-sm max-h-\[50vh\] overflow-y-auto">.*?</div>\n                </ConfirmationModal>'
    text2, n = re.subn(pattern, new_body, text, count=1, flags=re.S)
if n == 0:
    raise SystemExit("pattern not found")
p.write_text(text2, encoding="utf-8")
print("patched ok")
