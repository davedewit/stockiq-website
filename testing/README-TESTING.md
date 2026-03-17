# StockIQ Testing Suite

Comprehensive testing system to verify all website functionality after changes.

## Quick Start

```bash
# Run the test suite
./run-tests.sh
```

## Test Options

### 1. Quick Test (Recommended for regular use)
```bash
npm run test:quick
```
- ⚡ Fast execution (30 seconds)
- Tests essential functionality
- Headless browser (no UI)
- Perfect for quick verification

**Tests:**
- Page loading (index, analysis)
- Search functionality
- Coming soon popups
- JavaScript error detection

### 2. Full Test Suite (Comprehensive)
```bash
npm run test
```
- 🧪 Complete testing (5-10 minutes)
- Visual browser window
- Manual interaction required
- Thorough coverage

**Tests:**
- All quick tests +
- Navigation menus
- Mobile responsiveness
- Authentication flow
- Performance metrics
- CSS loading verification

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start local server:**
   ```bash
   npm run serve
   ```

3. **Run tests:**
   ```bash
   ./run-tests.sh
   ```

## Test Results

The tests will show:
- ✅ **PASS**: Feature working correctly
- ❌ **FAIL**: Issue detected with details
- 📊 **Summary**: Pass/fail statistics

## When to Run Tests

### Always run before:
- Deploying to production
- Major feature releases
- After JavaScript changes
- After CSS modifications

### Quick test after:
- Minor content updates
- Bug fixes
- Configuration changes

## Troubleshooting

### Common Issues:

**"Server not running"**
```bash
python3 -m http.server 8000
```

**"Puppeteer not found"**
```bash
npm install puppeteer
```

**"Tests timing out"**
- Check internet connection
- Verify local server is running
- Increase timeout in test files

### Manual Testing Checklist

If automated tests fail, manually verify:

1. **Pages Load**
   - [ ] index.html loads
   - [ ] analysis.html loads
   - [ ] dashboard.html loads

2. **Search Works**
   - [ ] Can type in search box
   - [ ] Search button clickable

3. **Analysis Options**
   - [ ] Menu options display
   - [ ] Options are clickable
   - [ ] Back button works

4. **Coming Soon Popups**
   - [ ] Popup appears
   - [ ] "Got it" button works
   - [ ] No dark overlay remains

5. **Mobile View**
   - [ ] Responsive design works
   - [ ] Mobile menu functions

## Extending Tests

To add new tests, edit `test-suite.js`:

```javascript
await this.test('New Feature Test', async () => {
    // Your test code here
    await this.page.goto(`${this.baseUrl}/your-page.html`);
    // Add assertions
});
```

## Performance Monitoring

The tests also check:
- Page load times (< 5 seconds)
- JavaScript errors
- CSS loading
- Mobile responsiveness

## CI/CD Integration

For automated deployment, add to your pipeline:

```bash
# In your deployment script
./run-tests.sh
if [ $? -eq 0 ]; then
    echo "Tests passed, deploying..."
    # Your deployment commands
else
    echo "Tests failed, aborting deployment"
    exit 1
fi
```