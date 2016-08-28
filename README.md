# Hypebus
An open source bus tracker for the Champaign-Urbana area.

![Screenshot](/screenshot.png?raw=true)

## Libraries
Hypebus uses AngularJS 1.5. This webapp contains three main files:

- `controllers.js`: Contains all controllers necessary
- `directives.js`: Contains custom directives
- `filters.js`: Contains convienent filters to format custom data types

## Required APIs
Access to [Google Maps API V3](https://developers.google.com/maps/) and the [CUMTD API](https://developer.cumtd.com/) are required.

## Build Notes
Hypebus uses Bower to manage dependencies. Important dependencies includes:

- `angular`
- `angular-route`
- `jquery`

This webapp is intended to be used with Google App Engine. `app.yaml` is not provided and has to be created and configured to serve files in `/public`.

Favicon is located in `/public/icons` and a `robots.txt` is also provided in `/public/assets`.

---

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Copyright 2016 - Derek Leung, Vincent Chang