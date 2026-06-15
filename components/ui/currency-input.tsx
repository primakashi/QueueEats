"use client";

import { useState } from "react";
import { Input } from "./input";
import { cn } from "@/lib/utils";

function toDisplay(raw: number): string {
  return raw === 0 ? "0" : raw.toLocaleString("id-ID");
}

function parseRaw(s: string): number {
  const digits = s.replace(/\D/g, "");
  return digits === "" ? 0 : parseInt(digits, 10);
}

// Uncontrolled: pass name + defaultValue; a hidden input carries the raw value for FormData.
interface UncontrolledProps {
  name: string;
  defaultValue?: number | string;
  value?: never;
  onValueChange?: never;
  id?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

// Controlled: pass value (raw number as string) + onValueChange; no hidden input.
interface ControlledProps {
  name?: never;
  defaultValue?: never;
  value: string;
  onValueChange: (raw: string) => void;
  id?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

type Props = UncontrolledProps | ControlledProps;

export function CurrencyInput(props: Props) {
  const { id, placeholder = "0", required, disabled, autoFocus, className } = props;

  // Uncontrolled mode
  if ("name" in props && props.name) {
    const initRaw = parseRaw(String(props.defaultValue ?? 0));
    return (
      <UncontrolledCurrencyInput
        {...{ id, placeholder, required, disabled, autoFocus, className }}
        name={props.name}
        initRaw={initRaw}
      />
    );
  }

  // Controlled mode
  const raw = parseRaw(String((props as ControlledProps).value ?? "0"));
  const display = (props as ControlledProps).value === "" ? "" : toDisplay(raw);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    (props as ControlledProps).onValueChange(digits === "" ? "" : String(parseInt(digits, 10)));
  }

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
      className={className}
    />
  );
}

function UncontrolledCurrencyInput({
  name,
  initRaw,
  id,
  placeholder,
  required,
  disabled,
  autoFocus,
  className,
}: {
  name: string;
  initRaw: number;
  id?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  const [rawValue, setRawValue] = useState(initRaw);
  const [displayValue, setDisplayValue] = useState(toDisplay(initRaw));

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    const num = digits === "" ? 0 : parseInt(digits, 10);
    setRawValue(num);
    setDisplayValue(digits === "" ? "" : toDisplay(num));
  }

  return (
    <>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        className={cn(className)}
      />
      <input type="hidden" name={name} value={rawValue} />
    </>
  );
}
