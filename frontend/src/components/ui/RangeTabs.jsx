import { useUiPreferences } from "../../hooks/useUiPreferences";

const ranges = ["day", "week", "month"];

export default function RangeTabs({ value, onChange }) {
  const { t } = useUiPreferences();

  return (
    <div className="range-tabs">
      {ranges.map((range) => (
        <button
          key={range}
          type="button"
          className={value === range ? "range-tab active" : "range-tab"}
          onClick={() => onChange(range)}
        >
          {t(`range.${range}`)}
        </button>
      ))}
    </div>
  );
}
