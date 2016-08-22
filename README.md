# Rendestops
An open source bus tracker for the Champaign-Urbana area.

![Screenshot](/screenshot.png?raw=true)

## Libraries
Rendestops uses AngularJS 1.5. This webapp contains three main files:

- `controllers.js`: Contains all controllers necessary
- `directives.js`: Contains custom directives
- `filters.js`: Contains convienent filters to format custom data types

## Required APIs
Access to [Google Maps API V3](https://developers.google.com/maps/) and the [CUMTD API](https://developer.cumtd.com/) are required.

## Build Notes
Rendestops uses Bower to manage dependencies. Important dependencies includes:

- `angular`
- `angular-route`
- `jquery`

This webapp is intended to be used with Google App Engine. `app.yaml` is not provided and has to be created and configured to serve files in `/public`.

Favicon is located in `/public/icons` and a `robots.txt` is also provided in `/public/assets`.

Copyright 2016 - Derek Leung, Vincent Chang