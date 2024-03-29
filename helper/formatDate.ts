export function formatDate(isoDate: Date) {
  const newDate = new Date(isoDate);
  const formattedDate = new Intl.DateTimeFormat('fr-FR').format(newDate);

  return formattedDate;
}

export function getTimeBeforeExpiration(expirationDate: Date) {
  const currentDate = new Date();
  
  const timeDifference = expirationDate?.getTime() - currentDate.getTime();
  const millisecondsInDay = 24 * 60 * 60 * 1000;
  const daysBeforeExpiration = Math.ceil(timeDifference / millisecondsInDay);

  return daysBeforeExpiration;
}

export function formatToISOString(dateString: Date): string {
  const formattedDate = dateString.toISOString().split('T')[0];
  return formattedDate;
}
