import os
from collections import namedtuple
from opus_processor import OpusProcessor

# Mock objects to simulate faster-whisper's output structure
Word = namedtuple('Word', ['start', 'end', 'word', 'probability'])
Segment = namedtuple('Segment', ['start', 'end', 'text', 'words'])

def create_sample_ass_file(template_name, output_filename):
    """
    Generates a sample ASS subtitle file for a given template to preview animations hello world my name is opusclip.
    """
    print(f"\nGenerating sample captions for template: '{template_name}'")

    # Sample transcription data with realistic speech timing for karaoke testing
    sample_segments = [
        Segment(
            start=0.0, end=6.5, text="Hello everyone, welcome to our amazing AI video editor!",
            words=[
                Word(start=0.1, end=0.5, word="Hello", probability=0.95),
                Word(start=0.6, end=1.2, word="everyone,", probability=0.92),
                Word(start=1.4, end=1.9, word="welcome", probability=0.94),
                Word(start=2.0, end=2.2, word="to", probability=0.98),
                Word(start=2.3, end=2.6, word="our", probability=0.96),
                Word(start=2.7, end=3.3, word="amazing", probability=0.93),
                Word(start=3.5, end=3.8, word="AI", probability=0.97),
                Word(start=3.9, end=4.4, word="video", probability=0.95),
                Word(start=4.5, end=5.1, word="editor!", probability=0.91),
            ]
        ),
        Segment(
            start=6.8, end=11.2, text="This tool will transform your content creation process.",
            words=[
                Word(start=6.9, end=7.2, word="This", probability=0.96),
                Word(start=7.3, end=7.6, word="tool", probability=0.94),
                Word(start=7.7, end=7.9, word="will", probability=0.97),
                Word(start=8.0, end=8.6, word="transform", probability=0.92),
                Word(start=8.7, end=9.0, word="your", probability=0.95),
                Word(start=9.1, end=9.7, word="content", probability=0.93),
                Word(start=9.8, end=10.4, word="creation", probability=0.91),
                Word(start=10.5, end=11.1, word="process.", probability=0.89),
            ]
        )
    ]

    # Initialize the processor
    processor = OpusProcessor()

    # Use the Karaoke template with focus_word_bounce animation
    if template_name == "Karaoke":
        template_settings = processor.templates['Karaoke'].copy()
        template_settings['name'] = template_name
        template_settings['animationStyle'] = 'focus_word_bounce'
    else:
        template_settings = {'name': template_name}

    # Generate the ASS content for a specific template
    ass_content = processor.create_opus_ass_content(
        segments=sample_segments,
        template_settings=template_settings,
        play_res_x=1080,  # Vertical video width
        play_res_y=1920   # Vertical video height
    )

    # Save the content to a file
    output_path = os.path.join(os.path.dirname(__file__), output_filename)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(ass_content)

    print(f"Successfully created sample ASS file: {output_path}")
    print("You can load this file in a video player like VLC along with any video to see the captions.")

    # --- Test Case 2: PopUp Style ---
    popup_template_settings = {
        'name': 'PopUp',
        'fontFamily': 'Arial Black',
        'fontSize': 50,
        'fontColor': 'FFFFFF',
        'shadowColor': '000000',
        'position': 'bottom',
        'animationStyle': 'popup' # Explicitly request the new style
    }
    popup_ass_content = processor.create_opus_ass_content(sample_segments, popup_template_settings)
    with open("popup_test.ass", "w", encoding="utf-8") as f:
        f.write(popup_ass_content)
    print("Generated popup_test.ass")

if __name__ == '__main__':
    # --- CHOOSE YOUR TEMPLATE HERE ---
    # Available options: "Karaoke", "Beasty", "Mozi", "Deep Driver", "Popline"
    chosen_template = "Karaoke"
    
    create_sample_ass_file(chosen_template, "karaoke_test_new.ass")
