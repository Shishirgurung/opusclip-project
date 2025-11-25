"use client"

import React, { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { BrandTemplate } from '@/types'

interface AdvancedTogglesPanelProps {
  template: BrandTemplate
  onTemplateChange: (template: BrandTemplate) => void
}

export function AdvancedTogglesPanel({ template, onTemplateChange }: AdvancedTogglesPanelProps) {
  const [crossFadeValue, setCrossFadeValue] = useState('0.5s')

  const handleAiEmojisChange = (checked: boolean) => {
    onTemplateChange({
      ...template,
      aiEmojis: checked
    })
  }

  const handleAutoTransitionsChange = (checked: boolean) => {
    onTemplateChange({
      ...template,
      autoTransitions: checked
    })
  }

  const handleCrossFadeChange = (value: string) => {
    setCrossFadeValue(value)
    // You can extend the template type to include crossFade if needed
    // For now, we'll just update the local state
  }

  return (
    <div className="space-y-6 p-4 border rounded-lg bg-card">
      <h3 className="text-lg font-semibold">Advanced Settings</h3>
      
      {/* AI Emojis Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <label htmlFor="ai-emojis" className="text-sm font-medium">
            AI emojis
          </label>
        </div>
        <Switch
          id="ai-emojis"
          checked={template.aiEmojis}
          onCheckedChange={handleAiEmojisChange}
        />
      </div>

      {/* Auto Transitions Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <label htmlFor="auto-transitions" className="text-sm font-medium">
            Auto transitions
          </label>
          <Badge variant="secondary" className="text-xs">
            Pro
          </Badge>
        </div>
        <Switch
          id="auto-transitions"
          checked={template.autoTransitions}
          onCheckedChange={handleAutoTransitionsChange}
        />
      </div>

      {/* Cross Fade Dropdown - Only shown when auto transitions is enabled */}
      {template.autoTransitions && (
        <div className="flex items-center justify-between pl-4">
          <label htmlFor="cross-fade" className="text-sm font-medium text-muted-foreground">
            Cross fade
          </label>
          <Select value={crossFadeValue} onValueChange={handleCrossFadeChange}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.2s">0.2s</SelectItem>
              <SelectItem value="0.3s">0.3s</SelectItem>
              <SelectItem value="0.5s">0.5s</SelectItem>
              <SelectItem value="0.7s">0.7s</SelectItem>
              <SelectItem value="1.0s">1.0s</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}