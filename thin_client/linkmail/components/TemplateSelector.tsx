import React, { useState, useEffect } from "react"

interface Template {
  id: string
  icon: string
  name: string
  description: string
  content: string
  subjectLine: string
  purpose: string
  attachments?: any[]
}

interface Props {
  selectedTemplate: Template | null
  onTemplateSelect: (template: Template) => void
  userData?: any
}

const TemplateSelector: React.FC<Props> = ({ selectedTemplate, onTemplateSelect, userData }) => {
  const [templates, setTemplates] = useState<Template[]>([])

  // Default templates
  const defaultTemplates: Template[] = [
    {
      id: 'coffee-chat',
      icon: '☕',
      name: 'Coffee Chat',
      description: 'A friendly intro to chat',
      content: `Hi [Recipient First Name],

I'm a 3rd year Computer Science student at UCLA. [Mention something specific about their company or recent work that interests you].

I'd love to connect and learn more about your experience in [mention their field/industry]. Would you be open to a brief coffee chat?

Best regards,
[Sender Name]`,
      subjectLine: 'Coffee Chat with [Recipient Name]',
      purpose: 'to send a coffee chat request',
      attachments: []
    },
    {
      id: 'job-application',
      icon: '💼',
      name: 'Job Application',
      description: 'A professional email for recruiting',
      content: `Hi [Recipient First Name],

I'm [brief personal introduction including your background]. I'm really impressed by [mention something specific about their company's work or mission].

[Connect their company's work to your own experience or interests]. I'd love to learn about potential internship opportunities at [Company Name].

Best regards,
[Sender Name]`,
      subjectLine: 'Internship Inquiry - [Sender Name]',
      purpose: 'to send a job application',
      attachments: []
    }
  ]

  useEffect(() => {
    let allTemplates = [...defaultTemplates]

    // Add custom templates if user has them
    if (userData?.templates && Array.isArray(userData.templates)) {
      const customTemplates = userData.templates
        .filter(template => template && template.name)
        .map((template, index) => ({
          id: `custom-${index}`,
          icon: template.icon || '📝',
          name: template.name,
          description: template.description || 'Custom email template',
          content: template.content,
          subjectLine: template.subjectLine || `${template.name} with [Recipient Name]`,
          purpose: `to send a ${template.name} email`,
          attachments: template.attachments || []
        }))

      allTemplates = [...allTemplates, ...customTemplates]
    }

    setTemplates(allTemplates)

    // Auto-select first template if none selected
    if (!selectedTemplate && allTemplates.length > 0) {
      // Prefer custom templates over default ones
      const customTemplate = allTemplates.find(t => t.id.startsWith('custom-'))
      const templateToSelect = customTemplate || allTemplates[0]
      onTemplateSelect(templateToSelect)
    }
  }, [userData, selectedTemplate, onTemplateSelect])

  return (
    <div className="template-dropdown">
      {templates.map((template) => (
        <div
          key={template.id}
          className={`template-dropdown-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
          onClick={() => onTemplateSelect(template)}
        >
          <h1 className="template-dropdown-icon">{template.icon}</h1>
          <div>
            <h2>{template.name}</h2>
          </div>
        </div>
      ))}
    </div>
  )
}

export default TemplateSelector
