"use client"

import * as React from "react"
import { useState, useEffect, useRef } from "react"
import { AnimationStyle } from "@/types"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Play, Pause, RotateCcw } from "lucide-react"
import {
  executeGSAPAnimation,
  generateCSSAnimation,
  getAnimationDescription,
  getAllAnimationStyles,
  AnimationConfig,
  DEFAULT_ANIMATION_CONFIG,
  injectAnimationCSS
} from "@/lib/animation-engine"

interface AnimationSelectorProps {
  value: AnimationStyle
  onChange: (animation: AnimationStyle) => void
  config?: Partial<AnimationConfig>
  onConfigChange?: (config: Partial<AnimationConfig>) => void
  showPreview?: boolean
  showControls?: boolean
  className?: string
  disabled?: boolean
}

const SAMPLE_TEXTS = [
  "Amazing Results!",
  "BREAKTHROUGH",
  "This is incredible!",
  "Watch this magic",
  "Unbelievable power"
]

export function AnimationSelector({
  value,
  onChange,
  config = {},
  onConfigChange,
  showPreview = true,
  showControls = true,
  className = "",
  disabled = false
}: AnimationSelectorProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSampleIndex, setCurrentSampleIndex] = useState(0)
  const [animationTimeline, setAnimationTimeline] = useState<any>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const [viewMode, setViewMode] = useState<'dropdown' | 'grid'>('dropdown')

  const finalConfig = { ...DEFAULT_ANIMATION_CONFIG, ...config }
  const allAnimations = getAllAnimationStyles()

  // Inject CSS animations on mount
  useEffect(() => {
    injectAnimationCSS()
  }, [])

  // Clean up animation timeline on unmount
  useEffect(() => {
    return () => {
      if (animationTimeline) {
        animationTimeline.kill()
      }
    }
  }, [animationTimeline])

  const playAnimation = (animationStyle: AnimationStyle = value) => {
    if (!previewRef.current || disabled) return

    // Kill existing animation
    if (animationTimeline) {
      animationTimeline.kill()
    }

    setIsPlaying(true)

    // Try GSAP first, fallback to CSS
    if (typeof window !== 'undefined' && window.gsap) {
      const timeline = executeGSAPAnimation(
        previewRef.current,
        animationStyle,
        finalConfig,
        () => {
          setIsPlaying(false)
        }
      )
      setAnimationTimeline(timeline)
    } else {
      // Fallback to CSS animation
      const { className: animClass, style } = generateCSSAnimation(animationStyle, finalConfig)
      
      if (animClass) {
        // Apply styles
        Object.assign(previewRef.current.style, style)
        previewRef.current.className = `${previewRef.current.className.replace(/opus-anim-\w+/g, '')} ${animClass}`
        
        // Remove animation class after duration
        setTimeout(() => {
          if (previewRef.current) {
            previewRef.current.className = previewRef.current.className.replace(/opus-anim-\w+/g, '')
            setIsPlaying(false)
          }
        }, finalConfig.duration * 1000)
      } else {
        setIsPlaying(false)
      }
    }
  }

  const stopAnimation = () => {
    if (animationTimeline) {
      animationTimeline.kill()
      setAnimationTimeline(null)
    }
    setIsPlaying(false)
    
    // Reset preview element
    if (previewRef.current) {
      previewRef.current.className = previewRef.current.className.replace(/opus-anim-\w+/g, '')
      previewRef.current.style.transform = ''
      previewRef.current.style.opacity = ''
      previewRef.current.style.scale = ''
    }
  }

  const cycleSampleText = () => {
    setCurrentSampleIndex((prev) => (prev + 1) % SAMPLE_TEXTS.length)
  }

  const handleConfigChange = (key: keyof AnimationConfig, value: number | string) => {
    const newConfig = { ...finalConfig, [key]: value }
    onConfigChange?.(newConfig)
  }

  const AnimationPreview = () => (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview Area */}
        <div className="relative h-24 bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg flex items-center justify-center overflow-hidden">
          <div
            ref={previewRef}
            className="text-white font-bold text-lg text-center px-4 select-none cursor-pointer"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
            }}
            onClick={() => !isPlaying && playAnimation()}
          >
            {SAMPLE_TEXTS[currentSampleIndex]}
          </div>
        </div>

        {/* Preview Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => isPlaying ? stopAnimation() : playAnimation()}
              disabled={disabled}
            >
              {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {isPlaying ? 'Stop' : 'Play'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={cycleSampleText}
              disabled={disabled}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
          <Badge variant="secondary" className="text-xs">
            {getAnimationDescription(value)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )

  const AnimationControls = () => (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Animation Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Duration Control */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Duration: {finalConfig.duration}s</Label>
          <Slider
            value={[finalConfig.duration]}
            onValueChange={([value]) => handleConfigChange('duration', value)}
            min={0.1}
            max={3}
            step={0.1}
            disabled={disabled}
            className="w-full"
          />
        </div>

        {/* Intensity Control */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Intensity: {finalConfig.intensity}</Label>
          <Slider
            value={[finalConfig.intensity]}
            onValueChange={([value]) => handleConfigChange('intensity', value)}
            min={0.1}
            max={2}
            step={0.1}
            disabled={disabled}
            className="w-full"
          />
        </div>

        {/* Delay Control */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Delay: {finalConfig.delay}s</Label>
          <Slider
            value={[finalConfig.delay]}
            onValueChange={([value]) => handleConfigChange('delay', value)}
            min={0}
            max={2}
            step={0.1}
            disabled={disabled}
            className="w-full"
          />
        </div>

        {/* Easing Control */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Easing</Label>
          <Select
            value={finalConfig.easing}
            onValueChange={(value) => handleConfigChange('easing', value)}
            disabled={disabled}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ease-out">Ease Out</SelectItem>
              <SelectItem value="ease-in">Ease In</SelectItem>
              <SelectItem value="ease-in-out">Ease In Out</SelectItem>
              <SelectItem value="linear">Linear</SelectItem>
              <SelectItem value="bounce">Bounce</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )

  const GridSelector = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {allAnimations.map((animation) => (
        <Card
          key={animation}
          className={`cursor-pointer transition-all hover:shadow-md ${
            value === animation 
              ? 'ring-2 ring-primary bg-primary/5' 
              : 'hover:bg-accent/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => !disabled && onChange(animation)}
        >
          <CardContent className="p-3 text-center">
            <div className="text-sm font-medium capitalize mb-1">
              {animation === 'none' ? 'No Animation' : animation.replace('-', ' ')}
            </div>
            <div className="text-xs text-muted-foreground">
              {getAnimationDescription(animation).split(' ').slice(0, 3).join(' ')}...
            </div>
            {value === animation && (
              <Badge className="mt-2">
                Selected
              </Badge>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )

  return (
    <div className={`space-y-4 ${className}`}>
      {/* View Mode Toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Animation Style</Label>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={viewMode === 'dropdown' ? 'default' : 'outline'}
            onClick={() => setViewMode('dropdown')}
            disabled={disabled}
          >
            Dropdown
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            onClick={() => setViewMode('grid')}
            disabled={disabled}
          >
            Grid
          </Button>
        </div>
      </div>

      {/* Animation Selector */}
      {viewMode === 'dropdown' ? (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Select animation style">
              {value === 'none' ? 'No Animation' : value.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {allAnimations.map((animation) => (
              <SelectItem key={animation} value={animation}>
                <div className="flex items-center justify-between w-full">
                  <span className="capitalize">
                    {animation === 'none' ? 'No Animation' : animation.replace('-', ' ')}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {getAnimationDescription(animation).split(' ').slice(0, 2).join(' ')}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <GridSelector />
      )}

      {/* Preview and Controls */}
      {showPreview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimationPreview />
          {showControls && <AnimationControls />}
        </div>
      )}

      {/* Quick Test Button */}
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => playAnimation()}
          disabled={disabled || isPlaying || value === 'none'}
        >
          {isPlaying ? 'Playing...' : 'Test Animation'}
        </Button>
      </div>
    </div>
  )
}

export default AnimationSelector