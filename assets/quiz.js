function gradeQuiz(quiz) {
  const feedback = quiz.querySelector('[data-quiz-feedback]');
  quiz.querySelectorAll('[data-correct]').forEach((option) => {
    option.addEventListener('click', () => {
      const chosenIsRight = option.dataset.correct === 'true';
      quiz.querySelectorAll('[data-correct]').forEach((other) => {
        other.disabled = true;
        if (other.dataset.correct === 'true') other.dataset.state = 'right';
      });
      if (!chosenIsRight) option.dataset.state = 'wrong';
      feedback.textContent = option.dataset.feedback;
      feedback.hidden = false;
    });
  });
}

document.querySelectorAll('[data-quiz]').forEach(gradeQuiz);
