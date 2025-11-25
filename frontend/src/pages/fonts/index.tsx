
import React from "react";
import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <>
      <Head>
        <title>VideoClip - Online Video Editor</title>
        <meta name="description" content="Edit videos online with our powerful and easy-to-use video editor" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="container mx-auto px-4 py-16">
          <div className="flex flex-col items-center justify-center text-center space-y-8">
            <h1 className="text-5xl font-bold text-gray-900">VideoClip</h1>
            <p className="text-xl text-gray-600 max-w-2xl">
              A powerful online video editor that lets you create stunning videos with multiple clips, 
              audio tracks, text overlays, and effects - all in your browser.
            </p>
            
            <div className="mt-8">
              <Link href="/editor">
                <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 text-lg">
                  Start Editing <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
            
            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-3">Multiple Clips</h3>
                <p className="text-gray-600">Combine and arrange multiple video clips on your timeline</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-3">Audio Tracks</h3>
                <p className="text-gray-600">Add background music, voiceovers, and sound effects</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-xl font-semibold mb-3">Effects & Filters</h3>
                <p className="text-gray-600">Enhance your videos with professional effects and filters</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
