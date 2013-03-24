gm convert influence_bitmap.png -geometry 25%% influence_bitmap_small.png
pngcrush -ow -rem gAMA -rem cHRM -rem iCCP -rem sRGB influence_bitmap_small.png influence_bitmap_small_crushed.png
move influence_bitmap_small_crushed.png influence_bitmap_small.png

