const fs = require('fs');
const path = require('path');

const targets = [
  path.join(__dirname, '..', 'components', 'AnalysisMemoModal.tsx'),
  path.join(__dirname, 'write-analysis-memo.cjs'),
];

for (const filePath of targets) {
  let s = fs.readFileSync(filePath, 'utf8');
  s = s.replace(
    'className="space-y-6 max-h-[40vh] overflow-y-auto pr-1"',
    'className="space-y-6"'
  );
  if (!s.includes('disableInnerScroll\n                                    entries={teamMemoEntries}')) {
    s = s.replace(
      '<MemoTimelinePanel\n                                    entries={teamMemoEntries}',
      '<MemoTimelinePanel\n                                    disableInnerScroll\n                                    entries={teamMemoEntries}'
    );
  }
  if (!s.includes('disableInnerScroll\n                                                        entries={playerMemoEntries[key]')) {
    s = s.replace(
      '<MemoTimelinePanel\n                                                        compact\n                                                        entries={playerMemoEntries[key]',
      '<MemoTimelinePanel\n                                                        compact\n                                                        disableInnerScroll\n                                                        entries={playerMemoEntries[key]'
    );
  }
  if (!s.includes('disableInnerScroll\n                                                    entries={playerMemoEntries[p.id]')) {
    s = s.replace(
      '<MemoTimelinePanel\n                                                    compact\n                                                    entries={playerMemoEntries[p.id]',
      '<MemoTimelinePanel\n                                                    compact\n                                                    disableInnerScroll\n                                                    entries={playerMemoEntries[p.id]'
    );
  }
  fs.writeFileSync(filePath, s, 'utf8');
  console.log('ok', filePath);
}
