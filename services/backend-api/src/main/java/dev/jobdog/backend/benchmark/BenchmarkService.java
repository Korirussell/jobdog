package dev.jobdog.backend.benchmark;

import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class BenchmarkService {

    private final BenchmarkJobRepository benchmarkJobRepository;

    public BenchmarkService(BenchmarkJobRepository benchmarkJobRepository) {
        this.benchmarkJobRepository = benchmarkJobRepository;
    }

    @PostConstruct
    @Transactional
    public void seedBenchmarkJobs() {
        // Only seed if the table is empty
        if (benchmarkJobRepository.count() > 0) {
            return;
        }

        // Google SWE Intern
        BenchmarkJobEntity google = new BenchmarkJobEntity();
        google.setTitle("Software Engineer Intern");
        google.setCompany("Google");
        google.setCategory("FAANG");
        google.setDifficultyLevel(10);
        google.setDescription("""
                Google is seeking exceptional software engineering interns to work on next-generation technologies that change how billions of users connect, explore, and interact with information.
                
                Requirements:
                - Currently pursuing a BS, MS, or PhD in Computer Science or related field
                - Experience with data structures, algorithms, and software design
                - Proficiency in one or more: Java, C++, Python, Go
                - Strong problem-solving and analytical skills
                
                Preferred:
                - Previous internship experience at a tech company
                - Experience with distributed systems, machine learning, or cloud infrastructure
                - Open source contributions
                - Competitive programming background (ICPC, Codeforces, etc.)
                
                You will work on critical projects for Google's core products, collaborating with world-class engineers on problems of massive scale.
                """);
        benchmarkJobRepository.save(google);

        // Stripe Backend Engineer
        BenchmarkJobEntity stripe = new BenchmarkJobEntity();
        stripe.setTitle("Backend Engineer - New Grad");
        stripe.setCompany("Stripe");
        stripe.setCategory("UNICORN");
        stripe.setDifficultyLevel(9);
        stripe.setDescription("""
                Stripe is looking for backend engineers to help build the economic infrastructure for the internet. You'll work on payment processing systems that handle billions of dollars in transactions.
                
                Requirements:
                - BS or MS in Computer Science or equivalent practical experience
                - Strong foundation in computer science fundamentals
                - Experience building scalable backend systems
                - Proficiency in Ruby, Go, Java, or similar languages
                - Understanding of databases, APIs, and distributed systems
                
                Preferred:
                - Experience with payment systems, fintech, or financial infrastructure
                - Knowledge of security best practices and compliance (PCI-DSS)
                - Contributions to high-traffic production systems
                - Experience with Kubernetes, Docker, or cloud platforms (AWS, GCP)
                
                You'll design and implement APIs used by millions of businesses worldwide, ensuring reliability, security, and performance at scale.
                """);
        benchmarkJobRepository.save(stripe);

        // Cloudflare Systems Intern
        BenchmarkJobEntity cloudflare = new BenchmarkJobEntity();
        cloudflare.setTitle("Systems Engineer Intern");
        cloudflare.setCompany("Cloudflare");
        cloudflare.setCategory("UNICORN");
        cloudflare.setDifficultyLevel(9);
        cloudflare.setDescription("""
                Cloudflare is hiring systems engineering interns to work on our global edge network that powers 20% of the internet.
                
                Requirements:
                - Pursuing a degree in Computer Science, Computer Engineering, or related field
                - Strong programming skills in C, C++, Rust, or Go
                - Understanding of networking protocols (TCP/IP, HTTP, DNS)
                - Experience with Linux/Unix systems
                - Knowledge of systems programming and performance optimization
                
                Preferred:
                - Experience with network programming or distributed systems
                - Understanding of security concepts (DDoS mitigation, TLS/SSL)
                - Contributions to open source systems projects
                - Familiarity with eBPF, kernel development, or low-level optimization
                
                You'll work on performance-critical code that runs on our edge network, handling millions of requests per second globally.
                """);
        benchmarkJobRepository.save(cloudflare);

        // Meta (Facebook) ML Engineer
        BenchmarkJobEntity meta = new BenchmarkJobEntity();
        meta.setTitle("Machine Learning Engineer Intern");
        meta.setCompany("Meta");
        meta.setCategory("FAANG");
        meta.setDifficultyLevel(10);
        meta.setDescription("""
                Meta is seeking ML engineering interns to work on recommendation systems, computer vision, and NLP that power Facebook, Instagram, and WhatsApp.
                
                Requirements:
                - Pursuing MS or PhD in Computer Science, Machine Learning, or related field
                - Strong foundation in machine learning algorithms and deep learning
                - Experience with PyTorch, TensorFlow, or similar frameworks
                - Proficiency in Python and C++
                - Understanding of large-scale data processing
                
                Preferred:
                - Published research in ML conferences (NeurIPS, ICML, CVPR)
                - Experience with recommendation systems or ranking algorithms
                - Knowledge of distributed training and model optimization
                - Contributions to ML open source projects
                
                You'll develop ML models that serve billions of users, working on cutting-edge problems in personalization and content understanding.
                """);
        benchmarkJobRepository.save(meta);

        // Databricks Distributed Systems
        BenchmarkJobEntity databricks = new BenchmarkJobEntity();
        databricks.setTitle("Distributed Systems Engineer - New Grad");
        databricks.setCompany("Databricks");
        databricks.setCategory("UNICORN");
        databricks.setDifficultyLevel(8);
        databricks.setDescription("""
                Databricks is hiring new grad engineers to work on the Lakehouse platform, processing petabytes of data for thousands of enterprises.
                
                Requirements:
                - BS or MS in Computer Science or related field
                - Strong programming skills in Scala, Java, or similar JVM languages
                - Understanding of distributed systems concepts
                - Experience with data processing frameworks (Spark, Hadoop, Flink)
                - Knowledge of databases and query optimization
                
                Preferred:
                - Experience with Apache Spark or Delta Lake
                - Understanding of cloud platforms (AWS, Azure, GCP)
                - Knowledge of columnar storage formats (Parquet, ORC)
                - Contributions to big data open source projects
                
                You'll build the next generation of data processing infrastructure, working on query engines and storage systems at massive scale.
                """);
        benchmarkJobRepository.save(databricks);
    }

    public List<BenchmarkJobEntity> getAllBenchmarks() {
        return benchmarkJobRepository.findAllByOrderByDifficultyLevelDesc();
    }
}
