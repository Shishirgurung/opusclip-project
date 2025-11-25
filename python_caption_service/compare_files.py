def compare_files(file1_path, file2_path):
    with open(file1_path, 'r', encoding='utf-8') as f1, open(file2_path, 'r', encoding='utf-8') as f2:
        file1_lines = f1.readlines()
        file2_lines = f2.readlines()
    
    max_lines = max(len(file1_lines), len(file2_lines))
    
    print(f"{'Line':<5} {'Reference File':<50} {'Generated File':<50}")
    print("-" * 105)
    
    for i in range(max_lines):
        line1 = file1_lines[i].rstrip() if i < len(file1_lines) else ""
        line2 = file2_lines[i].rstrip() if i < len(file2_lines) else ""
        
        if line1 != line2:
            print(f"{i+1:<5} {line1:<50} {line2:<50} <-- DIFFERENCE")
        else:
            print(f"{i+1:<5} {line1:<50} {line2:<50}")

if __name__ == "__main__":
    compare_files("reference_karaoke.ass", "test_output.ass")
