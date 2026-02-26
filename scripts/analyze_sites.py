import os
import glob
import math

base_dir = r"D:\TOOL GOOGLE ANTIGRAVITY\5. Tool Testo\1. Database\Testo\BMT"

sites = [d for d in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, d))]

print("Sites found:", sites)

# We want to sample BMT metadata directly using our structure parser to see if there's a pattern in the thermal values that correlates with the site.
# Since I can't look at the JPEGs directly, I'll ask the user to tell me which sites correspond to which type of equipment.
