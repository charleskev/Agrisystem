# Crop detection model validation

The Crop Detection page uses the configured Google Gemini Vision provider for live image analysis. It is a real AI provider, but this project does **not** currently contain a locally trained crop detector, a labelled validation dataset, or measured crop-specific accuracy. Results are advisory. A likely common crop name may be retained with an explicit uncertainty warning when the exact species is not clear; `Unknown Crop` is reserved for images where no plant can be safely identified or a clearer image is needed.

## Required before claiming a validated crop model

1. Collect consented, real mobile and desktop camera images from the target farming areas.
2. Label crop class, scientific name where confirmed, growth stage, visible symptoms, disease or pest finding where laboratory or MAO-verified, and bounding boxes for each target object.
3. Keep separate farmer or farm groups in train, validation, and test sets to prevent the same farm scene appearing in more than one split.
4. Train a crop-specific classifier or detector for the approved list of crops and health conditions.
5. Measure per-class precision, recall, F1 score, and, for object detection, mAP at the chosen IoU thresholds. Test separately on mobile-camera and desktop-webcam images.
6. Register the measured evaluation results and model version in the system before exposing an accuracy claim to users.
7. Review disease and pesticide recommendations with MAO or a qualified crop specialist before publication.

## Current data sources

- [Department of Agriculture Bureau of Plant Industry production guides](https://buplant.da.gov.ph/production-guide/)
- [Department of Agriculture vegetable production manuals](https://hvcdp.da.gov.ph/production-manuals/)
- [IRRI Rice Knowledge Bank](https://www.knowledgebank.irri.org/)
- [DA National Color-Coded Agricultural Guide](https://amia.da.gov.ph/national-color-coded-agricultural-guide-nccag-map/)

These sources are used for the linked guidance cards. The application does not infer field soil, weather, variety, pest, disease, or harvest date from an image when the necessary farm record or verified source data is absent.
