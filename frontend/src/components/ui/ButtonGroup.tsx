import React from 'react';

interface ButtonOption {
  value: string;
  label: string;
}

interface ButtonGroupProps {
  options: ButtonOption[];
  selectedValue: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({ 
  options, 
  selectedValue, 
  onValueChange, 
  className = '' 
}) => {
  return (
    <div className={`flex space-x-2 p-1 bg-gray-200 rounded-lg ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onValueChange(option.value)}
          className={`
            px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ease-in-out
            ${selectedValue === option.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'bg-transparent text-gray-600 hover:bg-gray-300'
            }
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
