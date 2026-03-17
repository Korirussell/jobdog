import { test, expect } from '@playwright/test';

test.describe('Infinite Scroll', () => {
  test('should load more jobs when scrolling to bottom', async ({ page }) => {
    await page.goto('/');
    
    // Wait for initial jobs to load
    await page.waitForSelector('a[href*="http"]', { timeout: 10000 });
    
    // Get initial job count
    const initialJobs = await page.$$('a[href*="http"]');
    const initialCount = initialJobs.length;
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Wait for potential new jobs to load
    await page.waitForTimeout(2000);
    
    // Get new job count
    const newJobs = await page.$$('a[href*="http"]');
    const newCount = newJobs.length;
    
    // If there are more jobs available, count should increase
    // Otherwise, should show "END_OF_RESULTS"
    const hasMore = newCount > initialCount;
    const hasEndMessage = await page.locator('text=END_OF_RESULTS').count() > 0;
    
    expect(hasMore || hasEndMessage).toBeTruthy();
  });

  test('should show loading indicator when loading more', async ({ page }) => {
    await page.goto('/');
    
    // Wait for initial jobs
    await page.waitForSelector('a[href*="http"]', { timeout: 10000 });
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Check for loading indicator (might be brief)
    const hasLoadingIndicator = await page.locator('text=/LOADING_MORE|SCROLL_FOR_MORE/i').count() > 0;
    expect(hasLoadingIndicator).toBeTruthy();
  });
});
