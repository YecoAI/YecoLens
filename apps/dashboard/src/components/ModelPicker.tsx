import { useStore } from "../store/useStore";

export function ModelPicker() {
  const models = useStore((s) => s.models);
  const selectedModelId = useStore((s) => s.selectedModelId);
  const selectModel = useStore((s) => s.selectModel);

  return (
    <div className="sidebar__section">
      <div className="sidebar__title">models</div>
      {models.length === 0 ? (
        <div className="dim" style={{ fontSize: 11 }}>
          no models detected yet.
        </div>
      ) : (
        <div className="model-list">
          {models.map((m) => (
            <div
              key={`${m.provider}:${m.id}`}
              className={`model-item ${selectedModelId === m.id ? "model-item--active" : ""}`}
              onClick={() => selectModel(m.id)}
              title={m.details}
            >
              <span>{m.name}</span>
              <span className="model-item__provider">{m.provider}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
