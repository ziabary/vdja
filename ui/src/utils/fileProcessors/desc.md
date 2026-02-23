before applying a suggestion: 

if we keep bold,italic, normal blocks separated then paragraph merging algorithm will be too complex as it must sort blocks, find candidates, create virtual lines and then check for justify, drifts, etc. maybe it is better to create text as a markup language (md/xml) but also keep all glyphs info in order to further process for tables.
Whole process will generate a MD file so creating lines as MD is not a bad idea. The problem will be related to lines with some section started with bold and continued on next line

ok so rewrite a robust extractNativeTextBlocks but take  care of virtual space detection and injection algorithm it was too hard to be robust. also I think we must keep block position info in order to create tables 
