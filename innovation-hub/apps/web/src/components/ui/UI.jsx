import React from "react";
import { Sparkles } from "lucide-react";
import styles from "./UI.module.css";

export const Tooltip = ({ description, example, question }) => {
  const popupRef = React.useRef(null);
  const [alignClass, setAlignClass] = React.useState('');

  const handleMouseEnter = () => {
    if (popupRef.current) {
      const rect = popupRef.current.getBoundingClientRect();
      let classes = [];
      if (rect.right > window.innerWidth - 20) {
        classes.push(styles.alignRight);
      }
      if (rect.top < 80) {
        classes.push(styles.alignBottom);
      }
      setAlignClass(classes.join(' '));
    }
  };

  return (
    <span className={styles.tooltipWrapper} onMouseEnter={handleMouseEnter}>
      <span className={styles.tooltipIcon}>?</span>
      <span
        ref={popupRef}
        className={`${styles.tooltipPopup} ${alignClass}`}
      >
        {description && <div className={styles.tooltipDesc}>{description}</div>}
        {example && <div className={styles.tooltipExample}>e.g. {example}</div>}
        {question && <div className={styles.tooltipQuestion}>{question}</div>}
      </span>
    </span>
  );
};

export const FieldLabel = ({ children, tip }) => (
  <label
    style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
  >
    {children}
    {tip && <Tooltip {...tip} />}
  </label>
);

export const Card = ({ title, children, id, aiAction }) => {
  return (
    <div id={id} className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{title}</h2>
        {aiAction && (
          <button className={styles.aiBtn} onClick={aiAction}>
            <Sparkles size={14} /> AI Assist
          </button>
        )}
      </div>
      <div className={styles.cardBody}>{children}</div>
    </div>
  );
};

export const Slider = ({
  label,
  value,
  onChange,
  min = 1,
  max = 5,
  valueLabelMapping,
  tip,
}) => {
  const displayValue = valueLabelMapping
    ? valueLabelMapping[value]
    : `${value} / ${max}`;
  return (
    <div className={styles.sliderContainer}>
      <div className={styles.sliderHeader}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          {label}
          {tip && <Tooltip {...tip} />}
        </label>
        <span className={styles.sliderValue}>{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className={styles.sliderInput}
      />
      <div className={styles.sliderLabels}>
        {valueLabelMapping ? (
          <>
            <span>{valueLabelMapping[min]}</span>
            <span>{valueLabelMapping[max]}</span>
          </>
        ) : (
          <>
            <span>Low</span>
            <span>High</span>
          </>
        )}
      </div>
    </div>
  );
};

export const CheckboxGroup = ({ options, selected, onChange }) => {
  return (
    <div className={styles.checkboxGrid}>
      {options.map((opt) => (
        <label key={opt} className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => onChange(opt)}
            className={styles.checkboxInput}
          />
          <span
            className={`${styles.checkboxCustom} ${selected.includes(opt) ? styles.checked : ""}`}
          ></span>
          {opt}
        </label>
      ))}
    </div>
  );
};

export const AutoTextArea = ({
  value,
  onChange,
  placeholder,
  style,
  ...props
}) => {
  const textareaRef = React.useRef(null);
  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [value]);
  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        overflow: "hidden",
        minHeight: "80px",
        resize: "none",
        ...style,
      }}
      {...props}
    />
  );
};
