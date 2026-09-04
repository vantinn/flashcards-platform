"use client";

import type { ChangeEvent } from "react";
import { Input } from "./input";

export interface SearchBarProps {
  /** Uncontrolled mode (e.g. inside a GET <form>, like /explore's URL-driven search). */
  name?: string;
  defaultValue?: string;
  /** Controlled mode (e.g. instant client-side filtering of an already-fetched list). */
  value?: string;
  onChange?: (value: string) => void;
  placeholder: string;
  className?: string;
}

export function SearchBar({ name = "q", defaultValue, value, onChange, placeholder, className }: SearchBarProps) {
  const isControlled = value !== undefined;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event.target.value);
  }

  return (
    <Input
      type="search"
      aria-label={placeholder}
      placeholder={placeholder}
      className={className}
      {...(isControlled ? { value, onChange: handleChange } : { name, defaultValue })}
    />
  );
}
