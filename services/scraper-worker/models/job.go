package models

import (
	"time"
)

type Job struct {
	ID                      string
	Source                  string
	SourceJobID             string
	SourceURL               string
	Title                   string
	Company                 string
	Location                string
	EmploymentType          string
	DescriptionText         string
	DescriptionHash         string
	Status                  string
	MinimumYearsExperience  *int
	EducationLevel          *string
	PostedAt                *time.Time
	ScrapedAt               time.Time
}

type JobRequirementProfile struct {
	JobID             string
	RequiredSkills    []string
	PreferredSkills   []string
	ExtractionMethod  string
}
