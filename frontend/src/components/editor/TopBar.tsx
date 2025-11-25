
import React from "react";
import { useEditor } from "@/contexts/EditorContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Share, Download } from "lucide-react";
import Link from "next/link";

export function TopBar() {
  const { projectName, setProjectName } = useEditor();
  
  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4">
      <div className="flex items-center">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mr-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        
        <div className="flex items-center">
          <div className="w-8 h-8 bg-purple-600 rounded-md flex items-center justify-center text-white font-bold mr-2">
            V
          </div>
          <span className="font-medium">VideoClip</span>
        </div>
        
        <div className="ml-8">
          <Input
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="h-8 w-48 text-sm"
          />
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="sm">
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
        
        <Button variant="ghost" size="sm">
          <Share className="h-4 w-4 mr-2" />
          Share
        </Button>
        
        <Button className="bg-purple-600 hover:bg-purple-700 text-white">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>
    </div>
  );
}
