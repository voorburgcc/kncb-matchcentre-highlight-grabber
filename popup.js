async function initializePopup() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const urlInput = document.getElementById('url');
  
  if (tab.url && tab.url.includes('https://matchcentre.kncb.nl/match')) {
    urlInput.value = tab.url;
    document.getElementById('fetch').click();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializePopup();
  
  // Add event listeners to filter checkboxes
  document.getElementById('filter-wickets').addEventListener('change', applyFilters);
  document.getElementById('filter-fours').addEventListener('change', applyFilters);
  document.getElementById('filter-sixes').addEventListener('change', applyFilters);
  document.getElementById('bold-names').addEventListener('change', updateTableDisplay);

  // Initially hide the filter container until results are loaded
  const filterContainer = document.querySelector('.filter-container');
  if (filterContainer) {
    filterContainer.style.display = 'none';
  }

  // Add copy button to the UI
  addCopyTableButton();
    
  // Initialize table sorting
  initTableSorting();
});

document.getElementById('fetch').addEventListener('click', async () => {
  const urlInput = document.getElementById('url');
  const debugDiv = document.getElementById('debug');
  const highlightsArea = document.getElementById('highlights');
  const highlightsTableBody = document.querySelector('#highlightsTable tbody');
  
  let url = urlInput.value;
  
  debugDiv.innerHTML += 'Processing URL: ' + url + '<br>';
  
  if (url.includes('scorecard')) {
    url = url.replace('scorecard', 'ballbyball');
    debugDiv.innerHTML += 'Modified URL: ' + url + '<br>';
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Navigate to the ball-by-ball page
    await chrome.tabs.update(tab.id, { url });
    
    // Wait for navigation to complete
    debugDiv.innerHTML += '<br><h2><strong>Scraping & loading...</h2>';
    
    // Increase timeout to allow page to fully load
    setTimeout(async () => {
      try {
        debugDiv.innerHTML += 'Executing script to extract highlights...<br>';
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: extractHighlights
        });
        
        if (!result || !result[0] || !result[0].result) {
          debugDiv.innerHTML += 'Error: No results returned from extraction script<br>';
          return;
        }
        
        const highlights = result[0].result;
        debugDiv.innerHTML += `Extracted ${highlights.length} highlights<br>`;
        
        if (highlights.length === 0) {
          debugDiv.innerHTML += 'Warning: No highlights found. The page might still be loading or selectors may need updating.<br>';
          return;
        }
        
        // Sort highlights by over number
        const sortedHighlights = sortHighlightsByOver(highlights);
        debugDiv.innerHTML += 'Highlights sorted by over number.<br>';
        
        // Show the filter container now that we have results
        const filterContainer = document.querySelector('.filter-container');
        if (filterContainer) {
          filterContainer.style.display = 'block';
        }
        
        highlightsArea.value = sortedHighlights.join('\n');
        
        // Clear existing table rows
        highlightsTableBody.innerHTML = '';
        
        // Populate table with structured highlights
        sortedHighlights.forEach(highlight => {
          const [over, event, details] = parseHighlight(highlight);
          const row = document.createElement('tr');
          
          // Add data attributes to help with filtering
          let eventType = '';
          if (event === '🔴') eventType = 'wicket';
          else if (details.includes('6 runs')) eventType = 'six';
          else if (details.includes('4 runs')) eventType = 'four';
          
          row.setAttribute('data-event-type', eventType);
          
          row.innerHTML = `
            <td>${over}</td>
            <td>${event}</td>
            <td>${details}</td>
          `;
          highlightsTableBody.appendChild(row);
        });
        
        debugDiv.innerHTML += 'Table updated successfully.<br>';
        
        // Apply initial sorting on the Over column (column index 0) in ascending order
        sortTable(document.getElementById('highlightsTable'), 0, 'asc');
        
        // Apply filters to the initial table
        applyFilters();
        
        // Apply bold formatting if enabled
        if (document.getElementById('bold-names').checked) {
          updateTableDisplay();
        }
      } catch (innerError) {
        debugDiv.innerHTML += 'Error during extraction: ' + innerError.message + '<br>';
        debugDiv.innerHTML += 'Stack trace: ' + innerError.stack + '<br>';
      }
    }, 5000); // Increased from 2000ms to 5000ms (5 seconds)
    
  } catch (error) {
    debugDiv.innerHTML += 'Error: ' + error.message + '<br>';
    debugDiv.innerHTML += 'Stack trace: ' + error.stack + '<br>';
  }
});

function extractHighlights() {
  try {
    const highlights = [];
    let debugInfo = {};
    
    // Count elements for debugging
    debugInfo.wicketContainers = document.querySelectorAll('[class*="BallDetailViewStyle__WicketInformationContainer"]').length;
    debugInfo.sixContainers = document.querySelectorAll('.BallDetailViewStyle__BallContainer-gx5g4w-1.kByDFX').length;
    debugInfo.fourContainers = document.querySelectorAll('.BallDetailViewStyle__BallContainer-gx5g4w-1.kTpgGw').length;
    
    // Find all wickets
    document.querySelectorAll('[class*="BallDetailViewStyle__WicketInformationContainer"]').forEach(wicket => {
      // Navigate up to the parent that contains both the wicket info and the ball container
      const ballContainerInner = wicket.closest('.BallDetailViewStyle__BallContainerInner-gx5g4w-2');
      
      // Find the StandardContainer with the over number from the sibling ball container
      const overElement = ballContainerInner?.querySelector('.BallDetailViewStyle__StandardContainer-gx5g4w-3');
      const over = overElement ? overElement.textContent.trim() : 'Unknown';
      
      const playerName = wicket.querySelector('.BallDetailViewStyle__PersonName-gx5g4w-9')?.textContent.trim() || '';
      const dismissal = wicket.querySelector('.BallDetailViewStyle__PersonDismissal-gx5g4w-10')?.textContent.trim() || '';
      const stats = Array.from(wicket.querySelectorAll('.BallDetailViewStyle__StatItem-gx5g4w-12'))
        .map(stat => {
          const heading = stat.querySelector('.BallDetailViewStyle__StatHeading-gx5g4w-13')?.textContent.trim() || '';
          const value = stat.querySelector('.BallDetailViewStyle__StatValue-gx5g4w-14')?.textContent.trim() || '';
          return `${heading}${value}`;
        })
        .join(' ');
      highlights.push(`${over}|WICKET|${playerName} ${dismissal} ${stats}`);
    });
    
    // Find all sixes
    document.querySelectorAll('.BallDetailViewStyle__BallContainer-gx5g4w-1.kByDFX').forEach(six => {
      // Extract over number from the StandardContainer div
      const overElement = six.querySelector('.BallDetailViewStyle__StandardContainer-gx5g4w-3');
      const over = overElement ? overElement.textContent.trim() : 'Unknown';
      
      // Extract the run and commentary text separately - Define all variables before using them
      const runElement = six.querySelector('.BallDetailViewStyle__CenterStandardContainer-gx5g4w-4');
      const commentaryElement = six.querySelector('.BallDetailViewStyle__CommentaryContainer-gx5g4w-5');
      const runText = runElement ? runElement.textContent.trim() : '';
      const commentaryText = commentaryElement ? commentaryElement.textContent.trim() : '';
      
      // Now use the variables after they're all defined
      highlights.push(`${over}|SIX|${runText} ${commentaryText}`);
    });
    
    // Find all fours
    document.querySelectorAll('.BallDetailViewStyle__BallContainer-gx5g4w-1.kTpgGw').forEach(four => {
      // Extract over number from the StandardContainer div
      const overElement = four.querySelector('.BallDetailViewStyle__StandardContainer-gx5g4w-3');
      const over = overElement ? overElement.textContent.trim() : 'Unknown';
      
      // Extract the run and commentary text separately - Define all variables before using them
      const runElement = four.querySelector('.BallDetailViewStyle__CenterStandardContainer-gx5g4w-4');
      const commentaryElement = four.querySelector('.BallDetailViewStyle__CommentaryContainer-gx5g4w-5');
      
      // Make sure these are defined before using them
      let runText = '';
      if (runElement) {
        runText = runElement.textContent.trim();
      }
      
      let commentaryText = '';
      if (commentaryElement) {
        commentaryText = commentaryElement.textContent.trim();
      }
      
      // Now use the variables after they're all properly defined
      highlights.push(`${over}|FOUR|${runText} ${commentaryText}`);
    });
    
    return highlights;
  } catch (error) {
    return [`ERROR|EXTRACTION|${error.message}`];
  }
}

/**
 * Sorts highlights by over number (and ball number)
 * @param {string[]} highlights - Array of highlight strings
 * @returns {string[]} - Sorted array of highlight strings
 */
function sortHighlightsByOver(highlights) {
  // Create a copy to avoid modifying the original array
  const sortableHighlights = [...highlights];
  
  // Sort by over number
  sortableHighlights.sort((a, b) => {
    // Extract over numbers from the highlights
    const overA = a.split('|')[0];
    const overB = b.split('|')[0];
    
    // Handle 'Unknown' or missing over numbers
    if (overA === 'Unknown' || overA === 'N/A') return 1;
    if (overB === 'Unknown' || overB === 'N/A') return -1;
    
    // Parse over and ball numbers
    const [majorA, minorA = 0] = overA.split('.').map(Number);
    const [majorB, minorB = 0] = overB.split('.').map(Number);
    
    // Compare major over numbers first, then minor ball numbers
    if (majorA !== majorB) {
      return majorA - majorB;
    }
    return minorA - minorB;
  });
  
  return sortableHighlights;
}

/**
 * Applies filters to the highlights table based on checkbox selections
 */
function applyFilters() {
  const showWickets = document.getElementById('filter-wickets').checked;
  const showFours = document.getElementById('filter-fours').checked;
  const showSixes = document.getElementById('filter-sixes').checked;
  
  const rows = document.querySelectorAll('#highlightsTable tbody tr');
  
  rows.forEach(row => {
    const eventType = row.getAttribute('data-event-type');
    
    if (eventType === 'wicket' && !showWickets) {
      row.style.display = 'none';
    } else if (eventType === 'four' && !showFours) {
      row.style.display = 'none';
    } else if (eventType === 'six' && !showSixes) {
      row.style.display = 'none';
    } else {
      row.style.display = '';
    }
  });
}

/**
 * Initializes the table sorting functionality
 */
function initTableSorting() {
  const table = document.getElementById('highlightsTable');
  const headers = table.querySelectorAll('thead th');
  
  headers.forEach((header, index) => {
    header.addEventListener('click', () => {
      sortTable(table, index);
    });
    
    // Add sort cursor
    header.style.cursor = 'pointer';
    header.dataset.sortDirection = 'none';
    
    // Add empty span for later use with sort indicators
    const sortIndicator = document.createElement('span');
    sortIndicator.classList.add('sort-indicator');
    sortIndicator.style.fontSize = '0.8em';
    sortIndicator.style.marginLeft = '4px';
    header.appendChild(sortIndicator);
  });
}

/**
 * Sorts the table by the specified column index
 * @param {HTMLElement} table - The table element
 * @param {number} columnIndex - The index of the column to sort by
 * @param {string} forceDirection - Optional: force a specific direction ('asc' or 'desc')
 */
function sortTable(table, columnIndex, forceDirection = null) {
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const headers = table.querySelectorAll('thead th');
  const header = headers[columnIndex];
  
  // Determine sort direction
  let newDirection;
  if (forceDirection) {
    newDirection = forceDirection;
  } else {
    const currentDirection = header.dataset.sortDirection || 'none';
    newDirection = currentDirection === 'asc' ? 'desc' : 'asc';
  }
  
  // Reset all headers
  headers.forEach(h => {
    h.dataset.sortDirection = 'none';
    const indicator = h.querySelector('.sort-indicator');
    if (indicator) indicator.innerHTML = '';
  });
  
  // Update the clicked header
  header.dataset.sortDirection = newDirection;
  const indicator = header.querySelector('.sort-indicator');
  if (indicator) {
    indicator.innerHTML = newDirection === 'asc' ? '↑' : '↓';
  }
  
  // Sort the rows
  rows.sort((rowA, rowB) => {
    const cellA = rowA.querySelectorAll('td')[columnIndex].textContent.trim();
    const cellB = rowB.querySelectorAll('td')[columnIndex].textContent.trim();
    
    // Special handling for the "Over" column (index 0)
    if (columnIndex === 0) {
      return compareOvers(cellA, cellB, newDirection === 'desc');
    }
    
    // Regular string comparison for other columns
    if (newDirection === 'asc') {
      return cellA.localeCompare(cellB);
    } else {
      return cellB.localeCompare(cellA);
    }
  });
  
  // Rebuild the table with sorted rows
  tbody.innerHTML = '';
  rows.forEach(row => {
    tbody.appendChild(row);
  });
}

/**
 * Compares over numbers in format "X.Y"
 * @param {string} a - First over number
 * @param {string} b - Second over number
 * @param {boolean} reverse - Whether to reverse the comparison
 * @returns {number} - Comparison result (-1, 0, or 1)
 */
function compareOvers(a, b, reverse = false) {
  // Handle special case for "N/A"
  if (a === 'N/A' && b === 'N/A') return 0;
  if (a === 'N/A') return reverse ? -1 : 1;
  if (b === 'N/A') return reverse ? 1 : -1;
  
  // Parse over and ball numbers
  const [majorA, minorA = 0] = a.split('.').map(Number);
  const [majorB, minorB = 0] = b.split('.').map(Number);
  
  // Compare major over numbers first, then minor ball numbers
  if (majorA !== majorB) {
    return reverse ? majorB - majorA : majorA - majorB;
  }
  return reverse ? minorB - minorA : minorA - minorB;
}

/**
 * Adds a button to copy the table content
 */
function addCopyTableButton() {
  const filterContainer = document.querySelector('.filter-container');
  const filterOptions = document.querySelector('.filter-options');
  
  // Create a container for the button that will be positioned on the right
  const buttonContainer = document.createElement('div');
  buttonContainer.style.marginLeft = 'auto'; // Push to the right using flexbox
  
  const copyButton = document.createElement('button');
  
  // Create a simple white icon for the button
  const icon = document.createElement('span');
  icon.innerHTML = '⧉'; // Simple copy icon
  icon.style.fontSize = '16px';
  icon.style.marginRight = '6px';
  icon.style.color = 'white';
  
  copyButton.id = 'copy-table';
  copyButton.style.backgroundColor = '#2f337d';
  copyButton.style.color = 'white';
  copyButton.style.padding = '8px 15px';
  copyButton.style.border = 'none';
  copyButton.style.borderRadius = '4px';
  copyButton.style.cursor = 'pointer';
  copyButton.style.display = 'flex';
  copyButton.style.alignItems = 'center';
  
  // Add icon and text to button
  copyButton.appendChild(icon);
  copyButton.appendChild(document.createTextNode('Copy Table'));
  
  // Add event listener
  copyButton.addEventListener('click', copyTableToClipboard);
  
  // Add button to the container
  buttonContainer.appendChild(copyButton);
  
  // Make filter options container a flex container to allow auto-margin positioning
  filterOptions.style.display = 'flex';
  filterOptions.style.alignItems = 'center';
  filterOptions.style.flexWrap = 'wrap';
  
  // Add the button container to the filter options
  filterOptions.appendChild(buttonContainer);
}

/**
 * Updates the table display to apply bold formatting based on user preference
 */
function updateTableDisplay() {
  const useBoldNames = document.getElementById('bold-names').checked;
  const rows = document.querySelectorAll('#highlightsTable tbody tr');
  
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length >= 3 && cells[1].textContent.includes('🔴')) {
      const detailsCell = cells[2];
      const originalText = detailsCell.getAttribute('data-original-text') || detailsCell.textContent;
      
      // Store the original text if we haven't already
      if (!detailsCell.hasAttribute('data-original-text')) {
        detailsCell.setAttribute('data-original-text', originalText);
      }
      
      if (useBoldNames) {
        // Extract and bold batsman name
        const batsmanMatch = originalText.match(/^([A-Za-z\s\-']+?)(?:\s+\(|$|\s+b\s+|\s+c\s+|\s+lbw\s+|\s+st\s+)/i);
        if (batsmanMatch && batsmanMatch[1]) {
          const batsman = batsmanMatch[1].trim();
          const boldBatsman = convertToUnicodeBold(batsman);
          detailsCell.innerHTML = originalText.replace(batsman, boldBatsman);
        }
      } else {
        // Restore original text
        detailsCell.textContent = originalText;
      }
    }
  });
}

/**
 * Converts regular text to Unicode bold text (sans-serif style)
 * @param {string} text - The text to convert
 * @returns {string} - Unicode sans-serif bold version of the text
 */
function convertToUnicodeBold(text) {
  // Define mapping for regular characters to Unicode sans-serif bold characters
  const boldMap = {
    'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶', 'j': '𝗷',
    'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿', 's': '𝘀', 't': '𝘁',
    'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
    'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜', 'J': '𝗝',
    'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥', 'S': '𝗦', 'T': '𝗧',
    'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
    '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵',
    '-': '-', ' ': ' ', "'": "'"  // Keep some special characters unchanged
  };

  return text.split('').map(char => boldMap[char] || char).join('');
}

/**
 * Copies the table data to clipboard, excluding the header row
 */
function copyTableToClipboard() {
  const table = document.getElementById('highlightsTable');
  const rows = Array.from(table.querySelectorAll('tbody tr:not([style*="display: none"])'));
  const useBoldNames = document.getElementById('bold-names').checked;
  
  if (rows.length === 0) {
    return; // No data to copy
  }

  // Format the table data into a string with tabs between columns and newlines between rows
  let tableText = '';
  rows.forEach(row => {
    const cells = Array.from(row.querySelectorAll('td'));
    let rowData = cells.map(cell => cell.textContent.trim());
    
    // Check if this is a wicket event (identified by the 🔴 emoji)
    if (cells.length >= 3 && cells[1].textContent.includes('🔴')) {
      // For wicket events, add "Wicket!" prefix
      let modifiedDetails = "Wicket! " + rowData[2];
      rowData[2] = modifiedDetails;
    }
    
    tableText += rowData.join('\t') + '\n';
  });

  // Copy to clipboard
  navigator.clipboard.writeText(tableText)
    .then(() => {
      // Show a brief notification that copying succeeded
      const notification = document.createElement('div');
      notification.textContent = 'Table copied to clipboard!';
      notification.style.position = 'fixed';
      notification.style.bottom = '10px';
      notification.style.left = '50%';
      notification.style.transform = 'translateX(-50%)';
      notification.style.backgroundColor = 'green';
      notification.style.color = 'white';
      notification.style.padding = '10px';
      notification.style.borderRadius = '4px';
      notification.style.zIndex = '1000';
      
      document.body.appendChild(notification);
      
      // Remove the notification after a short time
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 2000);
    })
    .catch(err => {
      console.error('Failed to copy table: ', err);
    });
}

function parseHighlight(highlight) {
  const [over, event, details] = highlight.split('|');
  let formattedEvent = event;

  // Replace event types with emojis
  if (event === 'WICKET') {
    formattedEvent = '🔴'; // Unicode emoji for WICKET
  } else if (event === 'SIX') {
    formattedEvent = '6️⃣'; // Unicode emoji for SIX
  } else if (event === 'FOUR') {
    formattedEvent = '4️⃣'; // Unicode emoji for FOUR
  }

  // Format details for events
  let formattedDetails = details;
  const statsMatch = details.match(/R(\d+)\sB(\d+)\s4s(\d+)\s6s(\d+)/);
  if (statsMatch) {
    const [, runs, balls, fours, sixes] = statsMatch;
    formattedDetails = details.replace(
      /R(\d+)\sB(\d+)\s4s(\d+)\s6s(\d+)/,
      `(${runs} runs, ${balls} balls, ${fours}x4, ${sixes}x6)`
    );
  }

  return [over || 'N/A', formattedEvent, formattedDetails || 'N/A'];
}
