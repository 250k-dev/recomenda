"use client";

export function TemplateStagePicker({
  stages,
  selectedIds,
  onChange,
}: {
  stages: Array<{ id: string; name: string }>;
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  if (stages.length === 0) return null;
  const allOn = stages.every((stage) => selectedIds.has(stage.id));
  const toggleAll = () => {
    onChange(allOn ? new Set() : new Set(stages.map((stage) => stage.id)));
  };
  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={allOn} onChange={toggleAll} />
        Modelo todo
      </label>
      <div className="max-h-40 space-y-1.5 overflow-y-auto pl-1">
        {stages.map((stage) => (
          <label key={stage.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedIds.has(stage.id)}
              onChange={() => toggle(stage.id)}
            />
            <span>{stage.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
