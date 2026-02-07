# Makefile for PointBridge

# Extract version from manifest.json
# Uses grep/sed to find the "version": "x.y.z" line and extract x.y.z
VERSION := $(shell grep '"version":' manifest.json | sed -E 's/.*"version": "([^"]+)".*/\1/')

# Output filename
ZIP_NAME := pointbridge-v$(VERSION).zip

# Default target
all: zip

# Create the zip file
zip:
	@echo "Creating $(ZIP_NAME)..."
	zip -r $(ZIP_NAME) . -x "*.git*" -x "*.DS_Store" -x "Makefile" -x "*.zip"
	@echo "Done."

# Clean up zip files
clean:
	rm -f pointbridge-v*.zip
