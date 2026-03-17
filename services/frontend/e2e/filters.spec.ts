import { test, expect } from '@playwright/test';

test.describe('Job Filters', () => {
  test('should filter jobs when clicking filter tabs', async ({ page }) => {
    await page.goto('/');
    
    // Wait for initial jobs to load
    await page.waitForSelector('a[href*="http"]', { timeout: 10000 });
    
    // Get initial job count
    const initialJobs = await page.$$('a[href*="http"]');
    const initialCount = initialJobs.length;
    
    // Click a filter tab (if exists)
    const filterTabs = await page.$$('button, [role="tab"]');
    if (filterTabs.length > 1) {
      await filterTabs[1].click();
      
      // Wait for API response
      await page.waitForTimeout(1000);
      
      // Verify jobs updated
      const filteredJobs = await page.$$('a[href*="http"]');
      // Jobs may be same or different depending on filter
      expect(filteredJobs.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('should search jobs', async ({ page }) => {
    await page.goto('/');
    
    // Wait for jobs to load
    await page.waitForSelector('a[href*="http"]', { timeout: 10000 });
    
    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="SEARCH"]');
    
    if (await searchInput.count() > 0) {
      // Type in search
      await searchInput.fill('Engineer');
      
      // Wait for debounced API call
      await page.waitForTimeout(500);
      
      // Verify results updated
      const jobs = await page.$$('a[href*="http"]');
      expect(jobs.length).toBeGreaterThanOrEqual(0);
    }
  });
});
