import React from 'react';
import { ChevronDown } from 'lucide-react';

interface SettingsSectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  asForm?: boolean;
  className?: string;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  children,
  onSubmit,
  asForm = false,
  className = '',
}) => {
  const content = (
    <>
      <header className="settings-section-header">
        <h2 className="settings-section-title">{title}</h2>
        <p className="settings-section-desc">{description}</p>
      </header>
      <div className="settings-section-body">
        {children}
      </div>
    </>
  );

  if (asForm) {
    return (
      <form className={`settings-section-container ${className}`} onSubmit={onSubmit}>
        {content}
      </form>
    );
  }

  return (
    <div className={`settings-section-container ${className}`}>
      {content}
    </div>
  );
};

interface SettingRowProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  control?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  id?: string;
  htmlFor?: string;
  layout?: 'row' | 'stacked';
}

export const SettingRow: React.FC<SettingRowProps> = ({
  title,
  description,
  control,
  children,
  className = '',
  id,
  htmlFor,
  layout = 'row',
}) => {
  if (layout === 'stacked') {
    return (
      <div className={`setting-row setting-row-stacked ${className}`} id={id}>
        <div className="setting-row-text">
          <label htmlFor={htmlFor} className="setting-row-title">
            {title}
          </label>
          {description && (
            <span className="setting-row-desc" id={htmlFor ? `${htmlFor}-desc` : undefined}>
              {description}
            </span>
          )}
        </div>
        <div className="setting-row-stacked-control">
          {control || children}
        </div>
      </div>
    );
  }

  return (
    <div className={`setting-row setting-row-split ${className}`} id={id}>
      <div className="setting-row-text">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="setting-row-title">
            {title}
          </label>
        ) : (
          <span className="setting-row-title">{title}</span>
        )}
        {description && (
          <span className="setting-row-desc" id={htmlFor ? `${htmlFor}-desc` : undefined}>
            {description}
          </span>
        )}
      </div>
      <div className="setting-row-control">
        {control || children}
      </div>
    </div>
  );
};

interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  id,
  checked,
  onChange,
  disabled = false,
  ariaLabel,
  ariaDescribedBy,
}) => {
  return (
    <label className={`settings-switch-wrapper ${disabled ? 'disabled' : ''}`} htmlFor={id}>
      <input
        type="checkbox"
        role="switch"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-checked={checked}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        className="settings-switch-input"
      />
      <span className="settings-switch-track" aria-hidden="true">
        <span className="settings-switch-thumb" />
      </span>
    </label>
  );
};

interface CustomSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  ariaDescribedBy?: string;
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  id,
  value,
  onChange,
  children,
  ariaDescribedBy,
  className = '',
  ...props
}) => {
  return (
    <div className={`settings-select-wrapper ${className}`}>
      <select
        id={id}
        value={value}
        onChange={onChange}
        aria-describedby={ariaDescribedBy}
        className="settings-select"
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={16} className="settings-select-chevron" aria-hidden="true" />
    </div>
  );
};
