import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { Sidebar } from "@/components/editor/Sidebar";
import { VideoPreview } from "@/components/editor/VideoPreview";
import { Timeline } from "@/components/editor/Timeline";
import { TopBar } from "@/components/editor/TopBar";
import { EditorProvider, useEditor } from "@/contexts/EditorContext";
import { useTemplate } from "@/hooks/use-template";
import OpusTemplateSelector from "@/components/OpusTemplateSelector/OpusTemplateSelector";
import AnimationSelector from "@/components/AnimationSelector/AnimationSelector";
import CaptionCustomizer from "@/components/CaptionCustomizer/CaptionCustomizer";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle
} from "react-resizable-panels";
import { AnimationConfig, DEFAULT_ANIMATION_CONFIG } from "@/lib/animation-engine";
import type { AnimationStyle, CaptionSettings } from "@/types";

const EditorWrapper = () => {
  const router = useRouter();

  // Core editor state
  const { timelineClips, selectedClipId, updateTimelineClip } = useEditor();

  // Template management
  const { currentTemplate, setCurrentTemplate, updateTemplate } = useTemplate();
  const template = currentTemplate;

  // Derive selected clip
  const selectedClip = timelineClips.find(clip => clip.id === selectedClipId) || null;
  const updateClip = updateTimelineClip;

  // Local state for animation config
  const [animationConfig, setAnimationConfig] = useState<Partial<AnimationConfig>>(DEFAULT_ANIMATION_CONFIG);
  const updateAnimationConfig = (config: Partial<AnimationConfig>) => {
    setAnimationConfig(config);
  };

  // Wrapper to update animation style in the template
  const updateAnimationStyle = (style: AnimationStyle) => {
    updateTemplate(template.id, {
      captionSettings: {
        ...template.captionSettings,
        animationStyle: style
      }
    });
  };

  // Wrapper to update caption settings in the template
  const updateCaptionSettings = (newSettings: CaptionSettings) => {
    updateTemplate(template.id, {
      captionSettings: newSettings
    });
  };

  // Route guard: redirect to dashboard if no timeline clips
  useEffect(() => {
    if (timelineClips.length === 0) {
      router.replace('/dashboard');
    }
  }, [timelineClips, router]);

  // Show loading state when template or selected clip is not ready
  if (!template) {
    return <div>Loading editor...</div>;
  }

  if (!selectedClip) {
    return <div>Loading editor...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <TopBar />
      {/* Main layout PanelGroup: Sidebar | (VideoPreview / Timeline) | RightPanel */}
      <PanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        {/* Left Panel (Sidebar) */}
        <Panel defaultSize={20} minSize={15} maxSize={30} className="bg-gray-800 text-white">
          <Sidebar />
        </Panel>
        <PanelResizeHandle className="w-1 bg-gray-300 hover:bg-purple-500 transition-colors data-[resize-handle-active]:bg-purple-600" />

        {/* Center Panel Group (VideoPreview and Timeline) */}
        <Panel defaultSize={55} minSize={30}>
          <PanelGroup direction="vertical">
            {/* Video Preview Panel */}
            <Panel defaultSize={60} minSize={20} className="bg-gray-100">
              <VideoPreview />
            </Panel>
            <PanelResizeHandle className="h-1 bg-gray-300 hover:bg-purple-500 transition-colors data-[resize-handle-active]:bg-purple-600" />
            {/* Timeline Panel */}
            <Panel defaultSize={40} minSize={15} className="bg-gray-800 text-white">
              <Timeline />
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle className="w-1 bg-gray-300 hover:bg-purple-500 transition-colors data-[resize-handle-active]:bg-purple-600" />

        {/* Right Panel: Opus Clip Customization */}
        <Panel defaultSize={25} minSize={15} maxSize={30} className="bg-white overflow-y-auto p-4">
          {/* Template Selector */}
          <div className="mb-6">
            <OpusTemplateSelector
              selectedTemplate={template}
              onTemplateSelect={setCurrentTemplate}
            />
          </div>
          {/* Animation Selector */}
          <div className="mb-6">
            <AnimationSelector
              value={template.captionSettings.animationStyle}
              onChange={updateAnimationStyle}
              config={animationConfig}
              onConfigChange={updateAnimationConfig}
            />
          </div>
          {/* Caption Customizer */}
          <div className="mb-6">
            <CaptionCustomizer
              settings={template.captionSettings}
              onSettingsChange={updateCaptionSettings}
            />
          </div>
          {/* Clip properties editor (fallback) */}
          <div className="mt-6">
            {/* Retain existing clip editing functionality */}
            {/* Users can edit clip-level metadata here */}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default function Editor() {
  return (
    <>
      <Head>
        <title>VideoClip - Editor</title>
        <meta name="description" content="Edit your video with VideoClip" />
      </Head>

      <EditorProvider>
        <EditorWrapper />
      </EditorProvider>
    </>
  );
}