import { test, expect } from '@playwright/test';

test.describe('Job Listing', () => {
  test('should load and display jobs', async ({ page }) => {
    await page.goto('/');
    
    // Wait for jobs to load
    await page.waitForSelector('a[href*="http"]', { timeout: 10000 });
    
    // Verify job count is displayed
    await expect(page.locator('text=/SHOWING.*POSITIONS/i')).toBeVisible();
    
    // Verify at least one job is displayed
    const jobLinks = await page.$$('a[href*="http"]');
    expect(jobLinks.length).toBeGreaterThan(0);
  });

  test('should open job in new tab when clicked', async ({ page, context }) => {
    await page.goto('/');
    
    // Wait for jobs to load
    await page.waitForSelector('a[href*="http"]', { timeout: 10000 });
    
    // Get first job link
    const firstJob = page.locator('a[href*="http"]').first();
    const href = await firstJob.getAttribute('href');
    
    // Verify it has target="_blank"
    const target = await firstJob.getAttribute('target');
    expect(target).toBe('_blank');
    
    // Verify it has rel="noopener noreferrer"
    const rel = await firstJob.getAttribute('rel');
    expect(rel).toContain('noopener');
  });

  test('should have keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Wait for jobs to load
    await page.waitForSelector('a[href*="http"]', { timeout: 10000 });
    
    // Tab to first job
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Verify focus is visible (check for outline)
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      const styles = window.getComputedStyle(el!);
      return styles.outline !== 'none';
    });
    
    expect(focused).toBeTruthy();
  });
});
