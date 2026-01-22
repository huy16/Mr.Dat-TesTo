import os

def extract_jpeg_from_bmt(bmt_path, output_path):
    """
    Attempts to extract an embedded JPEG from a BMT file by finding the JPEG header.
    """
    try:
        with open(bmt_path, 'rb') as f:
            data = f.read()

        # JPEG Magic Numbers: Start (FF D8), End (FF D9)
        # We look for the first occurrences. Some files might have multiple, 
        # usually the first one is the preview or the main thermal image overlay.
        start_marker = b'\xFF\xD8'
        end_marker = b'\xFF\xD9'

        start_index = data.find(start_marker)
        if start_index == -1:
            print(f"No JPEG start marker found in {bmt_path}")
            return False

        # Search for end marker after start marker
        end_index = data.find(end_marker, start_index)
        
        # JPEG files can contain thumbnails, so we might find an end marker early.
        # However, for a simple extraction, let's grab from start to the last end marker 
        # or try to be smarter if this fails. 
        # Let's search for the LAST end marker to be safe, or just take the first valid block.
        # A safer bet for embedded images is often finding the largest block between markers,
        # but let's try the first one first.
        
        if end_index == -1:
             print(f"No JPEG end marker found in {bmt_path}")
             return False

        jpeg_data = data[start_index:end_index + 2] # Include the end marker

        with open(output_path, 'wb') as out:
            out.write(jpeg_data)
        
        print(f"Successfully extracted image to {output_path}")
        return True

    except Exception as e:
        print(f"Error processing {bmt_path}: {e}")
        return False

if __name__ == "__main__":
    # Test with the file we know exists
    test_file = r"D:\TOOL GOOGLE ANTIGRAVITY\5. Tool Testo\1. Database\Image Site\KHO\1637\Testo Images\IR001366.BMT"
    output_test = "test_extracted.jpg"
    
    if os.path.exists(test_file):
        extract_jpeg_from_bmt(test_file, output_test)
    else:
        print(f"Test file not found: {test_file}")
