export function format(isoString) {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(date);
  } catch (error) {
    return isoString;
  }
}
