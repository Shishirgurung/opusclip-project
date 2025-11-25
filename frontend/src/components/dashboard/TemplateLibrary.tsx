import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTemplate } from '@/hooks/use-template';
import { defaultTemplate } from '@/lib/template-storage';

export const TemplateLibrary: React.FC = () => {
  const {
    templates,
    setCurrentTemplate,
    addTemplate,
    removeTemplate,
  } = useTemplate();
  const [newTemplateName, setNewTemplateName] = useState('');

  const handleAddTemplate = useCallback(() => {
    if (!newTemplateName.trim()) return;

    addTemplate({
      ...defaultTemplate,
      name: newTemplateName,
    });

    setNewTemplateName('');
  }, [newTemplateName, addTemplate]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New Template</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="new-template-name">Template Name</Label>
            <div className="flex gap-2">
              <Input
                id="new-template-name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., 'My Awesome Podcast'"
              />
              <Button onClick={handleAddTemplate} disabled={!newTemplateName.trim()}>Create</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-medium">Your Library</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <CardTitle>{template.name}</CardTitle>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCurrentTemplate(template)}>Select</Button>
                <Button variant="destructive" onClick={() => removeTemplate(template.id)}>Remove</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
