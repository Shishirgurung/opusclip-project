import React, { useState } from 'react';

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange }) => {
  const [color, setColor] = useState(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setColor(newColor);
    onChange(newColor);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={color}
        onChange={handleChange}
        className="w-8 h-8 rounded-full cursor-pointer"
      />
      <input
        type="text"
        value={color}
        onChange={handleChange}
        className="w-24 h-8 rounded px-2 border"
      />
    </div>
  );
};