package scraper

import (
	"regexp"
	"strings"
)

var skillKeywords = []string{
	"java", "python", "javascript", "typescript", "go", "golang", "rust", "c++", "c#",
	"react", "vue", "angular", "node", "nodejs", "express", "spring", "django", "flask",
	"postgresql", "mysql", "mongodb", "redis", "elasticsearch",
	"docker", "kubernetes", "aws", "gcp", "azure", "terraform",
	"git", "ci/cd", "jenkins", "github actions",
	"rest", "graphql", "grpc", "api",
	"linux", "bash", "shell",
	"machine learning", "ml", "ai", "deep learning", "tensorflow", "pytorch",
	"sql", "nosql", "database",
	"microservices", "distributed systems",
	"agile", "scrum",
}

var requiredIndicators = []string{
	"required", "must have", "must be", "essential", "mandatory",
}

var preferredIndicators = []string{
	"preferred", "nice to have", "bonus", "plus", "desired", "ideal",
}

func ExtractSkills(description string) (required []string, preferred []string) {
	lowerDesc := strings.ToLower(description)
	
	requiredSkills := make(map[string]bool)
	preferredSkills := make(map[string]bool)
	
	lines := strings.Split(lowerDesc, "\n")
	
	for _, line := range lines {
		isRequired := containsAny(line, requiredIndicators)
		isPreferred := containsAny(line, preferredIndicators)
		
		for _, skill := range skillKeywords {
			pattern := regexp.MustCompile(`\b` + regexp.QuoteMeta(skill) + `\b`)
			if pattern.MatchString(line) {
				if isRequired {
					requiredSkills[skill] = true
				} else if isPreferred {
					preferredSkills[skill] = true
				} else {
					requiredSkills[skill] = true
				}
			}
		}
	}
	
	for skill := range requiredSkills {
		required = append(required, skill)
	}
	for skill := range preferredSkills {
		if !requiredSkills[skill] {
			preferred = append(preferred, skill)
		}
	}
	
	return required, preferred
}

func containsAny(text string, keywords []string) bool {
	for _, keyword := range keywords {
		if strings.Contains(text, keyword) {
			return true
		}
	}
	return false
}
