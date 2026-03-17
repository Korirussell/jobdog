-- Add sample jobs to test frontend
-- Run this command: docker compose exec postgres psql -U jobdog -d jobdog -f add_sample_jobs.sql

INSERT INTO jobs (
    job_id, 
    source, 
    source_job_id, 
    source_url, 
    title, 
    company, 
    location, 
    employment_type, 
    description_text, 
    status, 
    posted_at, 
    scraped_at
) VALUES 
-- Sample Job 1
(
    gen_random_uuid(),
    'github',
    'gh-001',
    'https://github.com/jobs/sample1',
    'Senior Software Engineer',
    'TechCorp Solutions',
    'Remote',
    'full-time',
    'We are looking for a Senior Software Engineer to join our growing team. You will work on cutting-edge web applications using React, Node.js, and cloud technologies. Requirements: 5+ years of experience, strong problem-solving skills, and experience with modern JavaScript frameworks.',
    'ACTIVE',
    NOW() - INTERVAL '1 day',
    NOW()
),

-- Sample Job 2
(
    gen_random_uuid(),
    'greenhouse',
    'gh-002',
    'https://boards.greenhouse.io/techcorp/jobs/12345',
    'Frontend Developer',
    'StartupXYZ',
    'San Francisco, CA',
    'full-time',
    'Join our frontend team to build amazing user experiences. We use React, TypeScript, and modern CSS. You should have 3+ years of frontend development experience and a passion for creating intuitive interfaces.',
    'ACTIVE',
    NOW() - INTERVAL '2 days',
    NOW()
),

-- Sample Job 3
(
    gen_random_uuid(),
    'workday',
    'wd-003',
    'https://workday.com/jobs/datacorp/67890',
    'Data Scientist',
    'DataCo Analytics',
    'New York, NY',
    'full-time',
    'DataCo is seeking a talented Data Scientist to join our analytics team. You will work on machine learning models, data analysis, and visualization projects. Requirements: MS/PhD in relevant field, experience with Python, R, and SQL.',
    'ACTIVE',
    NOW() - INTERVAL '3 days',
    NOW()
),

-- Sample Job 4
(
    gen_random_uuid(),
    'github',
    'gh-004',
    'https://github.com/jobs/sample4',
    'Full Stack Developer',
    'WebDev Inc',
    'Remote',
    'full-time',
    'Looking for an experienced Full Stack Developer to work on our SaaS platform. Tech stack: React, Node.js, PostgreSQL, AWS. Must have 4+ years of full-stack development experience.',
    'ACTIVE',
    NOW() - INTERVAL '4 days',
    NOW()
),

-- Sample Job 5
(
    gen_random_uuid(),
    'greenhouse',
    'gh-005',
    'https://boards.greenhouse.io/fintech/jobs/54321',
    'DevOps Engineer',
    'FinTech Solutions',
    'Chicago, IL',
    'full-time',
    'We need a DevOps Engineer to manage our cloud infrastructure. Experience with Docker, Kubernetes, CI/CD pipelines, and AWS/GCP required. You will be responsible for deployment automation and system reliability.',
    'ACTIVE',
    NOW() - INTERVAL '5 days',
    NOW()
),

-- Sample Job 6 - Remote Only
(
    gen_random_uuid(),
    'workday',
    'wd-006',
    'https://workday.com/jobs/remotefirst/11111',
    'Product Manager',
    'RemoteFirst Tech',
    'Remote',
    'full-time',
    'RemoteFirst Tech is hiring a Product Manager to lead our product strategy. You will work with engineering, design, and business teams to deliver amazing products. 5+ years of product management experience required.',
    'ACTIVE',
    NOW() - INTERVAL '6 days',
    NOW()
),

-- Sample Job 7
(
    gen_random_uuid(),
    'github',
    'gh-007',
    'https://github.com/jobs/sample7',
    'Backend Engineer',
    'API Masters',
    'Austin, TX',
    'full-time',
    'API Masters is looking for a Backend Engineer to design and implement scalable APIs. Experience with microservices, REST APIs, and databases required. Python/Go/Node.js experience preferred.',
    'ACTIVE',
    NOW() - INTERVAL '1 week',
    NOW()
),

-- Sample Job 8
(
    gen_random_uuid(),
    'greenhouse',
    'gh-008',
    'https://boards.greenhouse.io/mobileapp/jobs/98765',
    'Mobile Developer',
    'AppWorks',
    'Seattle, WA',
    'full-time',
    'AppWorks needs a Mobile Developer to build iOS and Android apps. Experience with React Native or native iOS/Android development required. You will work on consumer-facing mobile applications.',
    'ACTIVE',
    NOW() - INTERVAL '1 week',
    NOW()
),

-- Sample Job 9
(
    gen_random_uuid(),
    'workday',
    'wd-009',
    'https://workday.com/jobs/aiml/22222',
    'Machine Learning Engineer',
    'AI Innovations',
    'Boston, MA',
    'full-time',
    'AI Innovations is hiring ML Engineers to work on cutting-edge AI projects. Experience with deep learning, NLP, and computer vision preferred. PhD in ML/AI is a plus.',
    'ACTIVE',
    NOW() - INTERVAL '2 weeks',
    NOW()
),

-- Sample Job 10
(
    gen_random_uuid(),
    'github',
    'gh-010',
    'https://github.com/jobs/sample10',
    'Security Engineer',
    'CyberGuard',
    'Remote',
    'full-time',
    'CyberGuard needs a Security Engineer to protect our systems and data. Experience with security best practices, penetration testing, and compliance required. CISSP or similar certification preferred.',
    'ACTIVE',
    NOW() - INTERVAL '2 weeks',
    NOW()
);

-- Verify the jobs were inserted
SELECT COUNT(*) as total_jobs FROM jobs WHERE status = 'ACTIVE';

-- Show sample of inserted jobs
SELECT title, company, location, posted_at 
FROM jobs 
WHERE status = 'ACTIVE' 
ORDER BY posted_at DESC 
LIMIT 5;
